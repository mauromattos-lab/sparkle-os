// BrainClient — typed HTTP client for the SparkleOS Collective Brain
// Usage: see docs/sops/sop-agentes-consultar-cerebro.md

import { BrainClientError } from './errors.js';
import type {
  Insight,
  InsightInput,
  SearchResult,
  SearchOptions,
  ListFilters,
  PaginatedInsights,
  ContextEntry,
} from './types.js';

export interface BrainClientOptions {
  /** Base URL of the brain service, e.g. 'http://localhost:3003' */
  baseUrl: string;
  /** Optional Authorization header value */
  apiKey?: string;
}

export class BrainClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(options: BrainClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
    };
  }

  // --- Internal helpers ---

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, { ...init, headers: { ...this.headers, ...((init.headers as Record<string, string>) ?? {}) } });
    } catch (err) {
      throw new BrainClientError(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
        0,
      );
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok) {
      const message =
        body && typeof body === 'object' && 'error' in body
          ? String((body as { error: unknown }).error)
          : `HTTP ${res.status}`;
      throw new BrainClientError(message, res.status, body);
    }

    return body as T;
  }

  // --- Public API ---

  /**
   * Semantic search over validated/applied insights.
   * Defaults: threshold=0.75, limit=10, statusFilter=['validated','applied']
   */
  async search(query: string, options?: SearchOptions): Promise<{ results: SearchResult[] }> {
    const body: Record<string, unknown> = { query };
    if (options?.limit !== undefined) body['limit'] = options.limit;
    if (options?.threshold !== undefined) body['threshold'] = options.threshold;
    if (options?.statusFilter !== undefined) body['statusFilter'] = options.statusFilter;
    if (options?.minConfidence !== undefined) body['minConfidence'] = options.minConfidence;

    return this.request<{ results: SearchResult[] }>('/brain/insights/search', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get a single insight by ID.
   * Throws BrainClientError(404) if not found.
   */
  async getInsight(id: string): Promise<Insight> {
    return this.request<Insight>(`/brain/insights/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
  }

  /**
   * List insights with optional filters.
   * Returns paginated result.
   */
  async listInsights(filters?: ListFilters): Promise<PaginatedInsights> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.source) params.set('source', filters.source);
    if (filters?.nucleusId) params.set('nucleusId', filters.nucleusId);
    if (filters?.page !== undefined) params.set('page', String(filters.page));
    if (filters?.limit !== undefined) params.set('limit', String(filters.limit));

    const qs = params.toString();
    return this.request<PaginatedInsights>(`/brain/insights${qs ? `?${qs}` : ''}`, {
      method: 'GET',
    });
  }

  /**
   * Ingest a new insight into the Brain.
   * Returns the created insight with status='raw'.
   */
  async ingest(input: InsightInput): Promise<Insight> {
    return this.request<Insight>('/brain/insights', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  /**
   * High-level context retrieval for agent prompt injection.
   * Calls search() and returns reduced ContextEntry[] with only the fields
   * needed for injecting into an LLM prompt.
   */
  async getContext(taskDescription: string, options?: SearchOptions): Promise<ContextEntry[]> {
    const { results } = await this.search(taskDescription, options);
    return results.map((r) => ({
      id: r.id,
      content: r.content,
      source: r.source,
      confidenceLevel: r.confidenceLevel,
      similarity: r.similarity,
    }));
  }
}
