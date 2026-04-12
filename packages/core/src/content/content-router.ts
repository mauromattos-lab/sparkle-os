import { Hono } from 'hono';
import {
  createContentPost,
  updateContentPost,
  getContentPost,
  listContentPosts,
  getRecentPosts,
} from './content-store.js';
import type { UpdateContentPostInput } from './types.js';

const contentRouter = new Hono();

// GET /api/content/posts?clientId=plaka&limit=20
contentRouter.get('/posts', async (c) => {
  const clientId = c.req.query('clientId') ?? 'plaka';
  const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100);
  const posts = await listContentPosts(clientId, limit);
  return c.json(posts);
});

// GET /api/content/posts/recent?clientId=plaka&days=7
contentRouter.get('/posts/recent', async (c) => {
  const clientId = c.req.query('clientId') ?? 'plaka';
  const days = parseInt(c.req.query('days') ?? '7', 10);
  const posts = await getRecentPosts(clientId, days);
  return c.json(posts);
});

// GET /api/content/posts/:id
contentRouter.get('/posts/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id is required' }, 400);

  const post = await getContentPost(id);
  if (!post) return c.json({ error: 'Post not found' }, 404);
  return c.json(post);
});

// POST /api/content/posts
contentRouter.post('/posts', async (c) => {
  const body = await c.req.json<{ clientId?: string; topic?: string }>();
  const post = await createContentPost(body);
  return c.json(post, 201);
});

// PATCH /api/content/posts/:id
contentRouter.patch('/posts/:id', async (c) => {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'id is required' }, 400);

  const body = await c.req.json<UpdateContentPostInput>();
  const post = await updateContentPost(id, body);
  return c.json(post);
});

export { contentRouter };
