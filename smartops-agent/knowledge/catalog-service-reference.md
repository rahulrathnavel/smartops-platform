# SmartOps Codebase Knowledge — Catalog Service RAG Reference

This document is the **authoritative golden reference** for the SmartOps autonomous
self-healing system. It is designed to be chunked and embedded into a vector database
(Pinecone) so the LLM reasoning chain can retrieve precise, function-level context
when diagnosing and fixing bugs in the e-commerce microservices.

---

## 1. Architecture Overview

### Catalog Service — `e-commerce-base/services/catalog-service/`

The catalog-service is a Node.js/Express microservice that serves the product catalog
for the Ammazone e-commerce platform. It connects to Azure Cosmos DB (MongoDB API)
and exposes three REST routes.

**Tech stack:**
- Runtime: Node.js 22 (Alpine Docker image)
- Framework: Express.js
- Database: Azure Cosmos DB with MongoDB API (Mongoose ODM)
- Tracing: OpenTelemetry (`@opentelemetry/api`)
- Metrics: Prometheus via `prom-client` (custom `shared/metrics.js`)

**File structure:**
```
catalog-service/
├── src/
│   ├── index.js          ← Express app entry point, Mongoose connect
│   ├── tracing.js        ← OpenTelemetry auto-instrumentation setup
│   ├── models/
│   │   └── Product.js    ← Mongoose schema definition
│   ├── routes/
│   │   └── products.js   ← ** THE CRITICAL FILE ** — all product routes
│   └── seed/
│       └── seed-data.js  ← Initial product catalog data
├── package.json
├── Dockerfile
└── shared/
    └── metrics.js        ← Prometheus middleware (copied at build time)
```

---

## 2. Product Model — `src/models/Product.js`

The Mongoose schema defines the following fields:

```javascript
const productSchema = new mongoose.Schema({
  productId:        { type: String, required: true, unique: true },
  name:             { type: String, required: true },
  category:         { type: String, required: true, index: true },
  price:            { type: Number, required: true },  // ← This is a Number, NOT an object
  rating:           { type: Number, default: 0 },
  reviewsCount:     { type: Number, default: 0 },
  stock:            { type: Number, default: 0 },
  featured:         { type: Boolean, default: false },
  colors:           [String],
  shortDescription: String,
  description:      String,
  badge:            String,
  specs:            [String],
  images:           [String],
}, { timestamps: true });
```

### CRITICAL KNOWLEDGE:
- `price` is a **plain JavaScript Number** (e.g., `29.99`).
- It has **NO methods** like `.getDiscount()`, `.toFixed()` works because
  Number.prototype has it, but `.getDiscount()` does **NOT exist**.
- Calling `products[i].price.getDiscount()` will throw:
  `TypeError: products[i].price.getDiscount is not a function`
- This is the **primary bug injection point** for the self-healing demo.

---

## 3. Products Route — `src/routes/products.js` (GOLDEN REFERENCE)

This is the single most important file in the self-healing workflow.
The LLM must know its **exact correct structure** to generate accurate fixes.

### 3.1. Route: `GET /` — List all products

**Purpose:** Returns all products with optional filtering and sorting.

**Query Parameters:**
| Param      | Type   | Description                                    |
|------------|--------|------------------------------------------------|
| `category` | string | Filter by category (ignored if "All")          |
| `minRating`| number | Minimum rating filter (`$gte`)                 |
| `maxPrice` | number | Maximum price filter (`$lte`)                  |
| `search`   | string | Text search on `name` field (regex)            |
| `sort`     | string | One of: `priceAsc`, `priceDesc`, `rating`      |

**Correct implementation:**
```javascript
router.get('/', async (req, res) => {
  const span = tracer.startSpan('catalog.list');
  try {
    const { category, search, minRating, maxPrice, sort } = req.query;
    const filter = {};

    if (category && category !== 'All') filter.category = category;
    if (minRating) filter.rating = { $gte: parseFloat(minRating) };
    if (maxPrice) filter.price = { $lte: parseFloat(maxPrice) };
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    let sortObj = {};
    if (sort === 'priceAsc') sortObj = { price: 1 };
    else if (sort === 'priceDesc') sortObj = { price: -1 };
    else if (sort === 'rating') sortObj = { rating: -1 };

    let products = await Product.find(filter).sort(sortObj).lean();

    // Sort featured first in-memory (Cosmos DB can't sort booleans)
    if (!sort) {
      products.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }

    // NO other processing — products go directly to response
    span.setAttribute('catalog.result_count', products.length);
    span.setStatus({ code: 1 });
    res.json(products);
  } catch (err) {
    console.error(`Catalog list error: ${err.name}: ${err.message}`);
    span.recordException(err);
    span.setStatus({ code: 2, message: err.message });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    span.end();
  }
});
```

**Key facts for the LLM:**
- `.lean()` returns plain JS objects (not Mongoose documents).
- `Product.find(filter)` returns an array. Index access like `products[8]`
  may be undefined if fewer than 9 results.
- The response is always `res.json(products)` — a JSON array.
- Error handling uses OpenTelemetry span recording.

### 3.2. Route: `GET /categories` — List distinct categories

**Purpose:** Returns an array of unique category strings.

**Correct implementation:**
```javascript
router.get('/categories', async (_req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Key facts:**
- This route MUST be defined BEFORE `GET /:id` because Express matches
  routes in order. If `/:id` comes first, `/categories` would be captured
  as `id = "categories"`.
- No OpenTelemetry span (intentional — lightweight endpoint).

### 3.3. Route: `GET /:id` — Get single product

**Purpose:** Returns a single product by its `productId` field.

**Correct implementation:**
```javascript
router.get('/:id', async (req, res) => {
  const span = tracer.startSpan('catalog.getById');
  try {
    const product = await Product.findOne({ productId: req.params.id }).lean();
    if (!product) {
      span.setStatus({ code: 2, message: 'Not found' });
      return res.status(404).json({ error: 'Product not found' });
    }

    span.setStatus({ code: 1 });
    res.json(product);
  } catch (err) {
    console.error(`Catalog getById error: ${err.name}: ${err.message}`);
    span.recordException(err);
    span.setStatus({ code: 2, message: err.message });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    span.end();
  }
});
```

**Key facts:**
- Uses `findOne({ productId: ... })`, NOT `findById()`.
- `productId` is a custom String field (e.g., "PROD-001"), not MongoDB's `_id`.
- Returns 404 with JSON body if product not found.

### 3.4. Module Export

```javascript
module.exports = router;
```

- There is exactly ONE `module.exports = router;` at the end of the file.
- The router object is created once at the top: `const router = express.Router();`
- Do NOT declare `router` or `module.exports` more than once.

---

## 4. Entry Point — `src/index.js`

```javascript
app.use('/', productRoutes);
```

- Routes are mounted at `/` (root).
- So `GET /` is the product list, `GET /categories` is categories,
  `GET /:id` is single product.
- Health check at `GET /health` is defined directly in index.js.
- Metrics at `GET /metrics` is defined directly in index.js.

---

## 5. Known Bug Patterns & Fixes

### Bug Pattern 1: TypeError — `price.getDiscount is not a function`

**Injection:**
```javascript
if (products[8]) {
  const disc = products[8].price.getDiscount(); // TypeError!
  products[8].finalPrice = products[8].price - disc;
}
```

**Why it crashes:** `price` is a Number (e.g., 29.99). Numbers don't have a
`.getDiscount()` method. This throws `TypeError: products[8].price.getDiscount
is not a function` which causes the entire GET / route to return HTTP 500.

**Fix:** Remove the entire block. The products array should go directly to
`res.json(products)` after the featured sort.

### Bug Pattern 2: Deleted /categories route (MissingEndpoint)

**Injection:** Delete the `router.get('/categories', ...)` handler entirely.

**Why it crashes:** The frontend calls `GET /categories` to populate the
category filter dropdown. Without this route, Express falls through to
`GET /:id` with `id = "categories"`, which returns 404. The frontend
shows an empty category list or errors.

**Fix:** Restore the `/categories` route handler (see section 3.2 above).
It MUST be placed BEFORE the `/:id` route.

### Bug Pattern 3: Duplicate router/module.exports declarations

**Injection:** Copy-paste the entire file contents so `const router` and
`module.exports` appear twice.

**Why it crashes:** Node.js will throw `TypeError: Cannot set property 'route'
of undefined` or silently use only the last `module.exports`, losing all
routes defined before the second declaration.

**Fix:** Keep exactly ONE set of: require statements, router declaration,
route handlers (in order: `/`, `/categories`, `/:id`), and `module.exports`.

### Bug Pattern 4: Removed error handling (try/catch deleted)

**Injection:** Remove the try/catch blocks from route handlers.

**Why it crashes:** Any database error (Cosmos DB timeout, connection drop)
will cause an unhandled promise rejection, crashing the process.

**Fix:** Restore the try/catch/finally blocks with proper span recording
and error response.

### Bug Pattern 5: Wrong Mongoose query method

**Injection:** Change `Product.findOne({ productId: ... })` to
`Product.findById(req.params.id)`.

**Why it crashes:** `productId` is a custom String field like "PROD-001".
`findById()` uses MongoDB's `_id` (ObjectId), so it will either return
null (no match) or throw a CastError if the string isn't a valid ObjectId.

**Fix:** Use `Product.findOne({ productId: req.params.id })`.

---

## 6. Cosmos DB Constraints

These constraints affect how the LLM generates fixes:

1. **No `$text` index with Cosmos DB** — Use `$regex` for text search instead.
2. **No boolean sorting** — Must sort `featured` in-memory after the query.
3. **`retryWrites: false`** — Cosmos DB doesn't support retryable writes.
4. **TLS required** — Connection uses `tls: true` unless overridden.
5. **Serverless tier** — No throughput provisioning, auto-scales.

---

## 7. API Gateway Routing — `api-gateway/src/index.js`

The API gateway proxies requests to the catalog service:

```javascript
app.use('/api/products', proxy('catalog-service:3002'));
```

- Frontend calls `GET /api/products` → gateway → `catalog-service:3002/`
- Frontend calls `GET /api/products/categories` → gateway → `catalog-service:3002/categories`
- Frontend calls `GET /api/products/PROD-001` → gateway → `catalog-service:3002/PROD-001`

If any of these routes are missing from `products.js`, the frontend breaks.

---

## 8. Self-Healing Workflow Summary

1. **Detection:** `incident-detector.js` polls CloudWatch Logs for error patterns
   (TypeError, 500 errors, CrashLoopBackOff). Fires every 30 seconds.

2. **Diagnosis:** `reasoning-chain.js` Step 1 sends the error log to NVIDIA NIM
   Qwen3-480B LLM with a structured prompt. Returns JSON with rootCause,
   affectedFiles, fixStrategy.

3. **Context Retrieval:** Step 2 embeds the diagnosis and queries Pinecone for
   relevant code chunks. Also fetches the affected file from GitHub and
   recent git diffs.

4. **Fix Generation:** Step 3 builds a token-budgeted prompt with diagnosis +
   code context + Pinecone chunks + diffs. LLM generates JSON with file
   changes.

5. **Slack Notification:** Posts to Slack with the proposed fix. Developer
   can reply `1` (approve), `2` (reject), or `3 <suggestion>`.

6. **Approval → Deploy:** On approval, the agent:
   a. Applies the fix via K8s API (patches the deployment image)
   b. Creates a GitHub branch, commits the fix, opens a PR
   c. Auto-merges the PR
   d. Emits `incident:resolved` to the dashboard

---

## 9. File Relationships

```
products.js ──imports──→ Product.js (Mongoose model)
    │                        │
    │                        └── Schema: productId, name, category, price (Number),
    │                            rating, reviewsCount, stock, featured, colors,
    │                            shortDescription, description, badge, specs, images
    │
    └──exported to──→ index.js (Express app)
                          │
                          ├── app.use('/', productRoutes)
                          ├── GET /health
                          └── GET /metrics
```

---

## 10. Verification Checklist

When the LLM generates a fix for `products.js`, verify:

- [ ] File starts with `'use strict';`
- [ ] Exactly ONE `const router = express.Router();`
- [ ] Exactly THREE route handlers in this order: `GET /`, `GET /categories`, `GET /:id`
- [ ] `GET /categories` is defined BEFORE `GET /:id`
- [ ] No calls to `price.getDiscount()` or similar non-existent methods
- [ ] All route handlers have try/catch/finally with span management
- [ ] `Product.findOne({ productId: ... })` not `Product.findById()`
- [ ] Exactly ONE `module.exports = router;` at the end
- [ ] No duplicate `require()` statements
- [ ] No duplicate route handler definitions
