# Architectural & Schema Review: `clientController.js` vs. MatterMiner API Postman Collection

## Executive Summary

A deep review of [`src/controllers/clientController.js`](../src/controllers/clientController.js) and [`src/routes/clientRoutes.js`](../src/routes/clientRoutes.js) against the **MatterMiner API (`api.matterminer.com`, export 2026-10-30)** Postman collection reveals **critical structural divergences** across URL versioning, entity creation schemas (nested `contact_data` vs. flat fields), and completely mismatched payloads on key endpoints.

### Systemic Cross-Cutting Issues
> [!CAUTION]
> 1. **Missing `/v1` API Prefix Across All Endpoints**: Every `apiRequest` call in `clientController.js` uses `${process.env.BASE_URL}/api/...` (e.g., `/api/clients`, `/api/calendar`), whereas the Postman collection specifies `/api/v1/...` across all resources (`{{base_url}}/api/v1/clients`, `{{base_url}}/api/v1/calendar`, etc.). Unless `BASE_URL` or server-side route aliasing rewrites `/api/*` to `/api/v1/*`, requests will hit legacy or non-existent routes.
> 2. **Nested `contact_data` Refactoring in Core API**: Both **Create Client** (`POST /api/v1/clients`) and **Create Prospect** (`POST /api/v1/prospects`) in the Postman collection now expect personal contact fields (`first_name`, `last_name`, `email`, phone numbers) inside a nested `contact_data: { ... }` object, whereas `clientController.js` sends them as flat top-level keys.

---

## 1. Master Comparison Table: Request Schemas & Endpoints

| Controller Method | Local Route (`clientRoutes.js`) | Controller Target Path | Postman Collection Path | Schema / Structure Status | Key Schema Differences & Architectural Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `createEvent` (L13–L80) | `POST /standard-event` | `POST /api/calendar` | `POST /api/v1/calendar` | **Partial Match (Subset)** | Core fields (`title`, `start_datetime`, `end_datetime`, `description`, `location`, `timezone`, `is_all_day`, `matter_id`, `visibility`, `status`, `attendees`, `reminders`) match. Controller omits optional Postman fields (`colour_code`, `sync_to_calendar`, `recurrence_rule`, `user_id`, `calendar_event_type_id`, `event_type`). Note: Controller ignores `req.body.visibility` and `req.body.status`, hardcoding `"private"` and `"confirmed"`. |
| `createAllDayEvent` (L82–L141) | `POST /all-event` | `POST /api/calendar` | `POST /api/v1/calendar` | **Partial Match (Subset)** | Same target endpoint as `createEvent`. Sends `is_all_day: true`. Omits `location`, `timezone`, `attendees`, `event_type`, `sync_to_calendar`, etc. |
| `createContact` (L143–L204) | `POST /contact` | `POST /api/contacts` *(Commented out / Mocked)* | `POST /api/v1/contacts` | **Same Structure (Minor Omissions)** | Payload fields (`contact_type`, `title`, `first_name`, `middle_name`, `last_name`, `email`, `country_code`, `phone_number`, `model_type`, `model_id`, `active`, `featured`) match Postman schema. Omits `entity`, `entity_id`, `include_in_emails`. **Note:** API call at L181 is commented out and mocked, and `model_id: 1` is hardcoded. |
| `createClient` (L206–L259) | `POST /client`<br>`GET /client` | `POST /api/clients` | `POST /api/v1/clients` | **Changed (Breaking)** | **Structure Changed:** Controller sends flat `first_name`, `last_name`, `email` at the root. Postman schema moved these into nested `contact_data: { first_name, middle_name, last_name, title, email, ... }`. Root only accepts `client_type`, `company_name`, `country_id`, `street`, `contact_id`, `contact_data`, `form_input_values`, `tax_registrations`, etc. |
| `createMatter` (L261–L308) | *(Not mounted in `clientRoutes.js`)* | `POST /api/matters` | `POST /api/v1/matters` | **Changed (Critical Mismatch)** | **Completely Different Schema:** Controller sends `{ tenantId, full_name, email, phone, address }` (which looks like a legacy client/lead payload). Postman `POST /api/v1/matters` requires `{ client_id, name, practice_area_id, case_stage_id, billing_type_id, access_type, status, lawyer_assignments, ... }`. |
| `login` (L310–L351) | `POST /login` | `POST /api/login` | `POST /api/v1/login` | **Same Request / Changed Response** | **Request:** `{ email, password }` is identical.<br>**Response Mismatch:** Controller reads `result.data.token.access_token` (L330), whereas Postman's login test script reads `body.data.access_token || body.access_token`. |
| `isLoginSessionValid` (L353–L389) | `GET /hasValidToken` | *(Internal Redis Lookup)* | *(N/A - Local Session)* | **Runtime Bug (`ReferenceError`)** | Does not call external API, but L356 checks `if (!tenantId || ...)` without defining `tenantId` in the function scope, throwing a `ReferenceError: tenantId is not defined`. |
| `searchCountries` (L391–L437) | `GET /countries` | `GET /api/countries` | `GET /api/v1/countries` | **Same Structure (Extra Query Params)** | Controller sends query params `page`, `per_page`, `search`, `sort_by`, `sort_order`. Postman documents `page`, `per_page`, `sort_by` (Laravel pagination/filtering typically accepts `search` and `sort_order`). **Bug:** `result.data.data[0].id` (L416) crashes with `TypeError` if `data` is empty. |
| `getContactIdByEmail` (L439–L495) | `GET /search-contact` | `GET /api/contacts` | `GET /api/v1/contacts` | **Same Structure (Extra Query Params)** | Sends `page`, `per_page`, `search`, `sort_by`, `sort_order`. Also passes `{}` as GET body (`data`) and `null` as `customHeaders` (L463). Crashes if `result.data.data` is empty (`result.data.data[0].id`). |
| `getCaseStageInfo` (L497–L556) | `GET /case-stage` | `GET /api/case-stages` | `GET /api/v1/case-stages` | **Same Structure** | Sends `page`, `per_page`, `search`, `sort_by`, `sort_order`. Matches Postman's `GET /api/v1/case-stages` query structure. |
| `getPracticeAreaInfo` (L558–L618) | `GET /practice-area` | `GET /api/practice-areas` | `GET /api/v1/practice-areas` | **Same Structure** | Sends `page`, `per_page`, `search`, `sort_by`, `sort_order`. Matches Postman's `GET /api/v1/practice-areas`. |
| `getBillingInfo` (L620–L679) | `GET /billing-info` | `GET /api/billing-types` | `GET /api/v1/billing-types` | **Same Structure** | Sends `page`, `per_page`, `search`, `sort_by`, `sort_order`. Matches Postman's `GET /api/v1/billing-types`. |
| `createProspect` (L681–L726) | `POST /prospects` | `POST /api/prospects` | `POST /api/v1/prospects` | **Changed (Breaking)** | **Structure Changed:** Controller sends flat `{ client_type, first_name, last_name, email, lead_source_id, lead_status_id }`. Postman schema requires `contact_data: { first_name, last_name, title, email, primary_phone_number_country_code, primary_phone_number, ... }` plus root-level fields (`country_id`, `street`, `communication_channel_id`, `date_contacted`, `assigned_user`). |
| `getLeadSources` (L728–L769) | `GET /lead-sources` | `GET /api/lead-sources` | `GET /api/v1/lead-sources` | **Same Structure** | Sends `page`, `per_page`, `search`, `sort_by`, `sort_order`. Matches Postman's `GET /api/v1/lead-sources`. |
| `getLeadStatuses` (L771–L812) | `GET /lead-statuses` | `GET /api/lead-statuses` | `GET /api/v1/lead-statuses` | **Same Structure** | Sends `page`, `per_page`, `search`, `sort_by`, `sort_order`. Matches Postman's `GET /api/v1/lead-statuses`. |

---

## 2. Detailed Schema Walkthrough for Divergent Endpoints

### 2.1 `createClient` (`POST /api/v1/clients`)
In `createClient` (Lines 206–259), the controller constructs a flat payload, whereas the MatterMiner API v1 expects contact details nested under `contact_data`.

#### Current Payload in `clientController.js` (Lines 227–235)
```javascript
// Target: POST ${process.env.BASE_URL}/api/clients
const payload = {
    first_name,          // ❌ No longer at root level
    last_name,           // ❌ No longer at root level
    client_type,
    email: client_email, // ❌ No longer at root level
    country_id,
    street,
    contact_id
};
```

#### Expected Schema in Postman Collection (`POST /api/v1/clients`)
```json
{
  "reference_number": null,
  "client_type": "company",
  "company_name": null,
  "client_number": null,
  "override_reason": null,
  "country_id": 1,
  "street": "123 Main Street",
  "suite": null,
  "town": null,
  "state": null,
  "zip_code": null,
  "contact_id": null,
  "relationship_manager_id": null,
  "account_trusted": null,
  "acquisition_channel": null,
  "notes": null,
  "contact_data": {
    "first_name": "Jane",
    "middle_name": null,
    "last_name": "Doe",
    "title": null,
    "email": "user@example.com",
    "primary_phone_number_country_code": null,
    "primary_phone_number": null,
    "secondary_phone_number_country_code": null,
    "secondary_phone_number": null,
    "model_type": null,
    "model_id": null
  },
  "form_input_values": [],
  "tax_registrations": [
    {
      "name": "Example Name",
      "number": "example_string",
      "include_on_invoice": null
    }
  ]
}
```

---

### 2.2 `createProspect` (`POST /api/v1/prospects`)
Similarly, `createProspect` (Lines 681–726) sends `first_name`, `last_name`, and `email` at the root level instead of inside `contact_data`, and omits required/expected prospect fields like `country_id`, `street`, `communication_channel_id`, `date_contacted`, and `assigned_user`.

#### Current Payload in `clientController.js` (Lines 699–706)
```javascript
// Target: POST ${process.env.BASE_URL}/api/prospects
const payload = {
    client_type,
    first_name,          // ❌ Moved to contact_data.first_name
    last_name,           // ❌ Moved to contact_data.last_name
    email: client_email, // ❌ Moved to contact_data.email
    lead_source_id,
    lead_status_id
};
```

#### Expected Schema in Postman Collection (`POST /api/v1/prospects`)
```json
{
  "lead_number": null,
  "client_type": "company",
  "company_name": null,
  "country_id": 1,
  "street": "123 Main Street",
  "suite": null,
  "town": null,
  "state": null,
  "zip_code": null,
  "contact_id": null,
  "lead_source_id": 1,
  "lead_status_id": 1,
  "communication_channel_id": 1,
  "date_contacted": "2025-01-15T09:00:00Z",
  "assigned_user": 1,
  "notes": null,
  "approver_id": null,
  "contact_data": {
    "first_name": "Jane",
    "middle_name": null,
    "last_name": "Doe",
    "title": "Example Name",
    "email": "user@example.com",
    "primary_phone_number_country_code": "example_string",
    "primary_phone_number": "example_string",
    "secondary_phone_number_country_code": null,
    "secondary_phone_number": null,
    "model_type": null,
    "model_id": null
  }
}
```

---

### 2.3 `createMatter` (`POST /api/v1/matters`)
`createMatter` (Lines 261–308) has a completely incompatible payload. It sends `{ tenantId, full_name, email, phone, address }`, whereas the Matter endpoint expects legal matter metadata (`client_id`, `name`, `practice_area_id`, `case_stage_id`, `billing_type_id`, etc.).

#### Current Payload in `clientController.js` (Lines 282–284)
```javascript
// Target: POST ${process.env.BASE_URL}/api/matters
const payload = {
    tenantId,
    full_name,
    email,
    phone,
    address
};
```

#### Expected Schema in Postman Collection (`POST /api/v1/matters`)
```json
{
  "reference_number": null,
  "client_id": 1,
  "name": "Example Name",
  "matter_number": null,
  "override_reason": null,
  "practice_area_id": 1,
  "case_stage_id": 1,
  "billing_type_id": 1,
  "access_type": "public",
  "status": "open",
  "lawyer_assignments": [
    {
      "user_id": 1,
      "is_primary": true,
      "hourly_rate": null,
      "rate_currency": null
    }
  ],
  "limitation_statutes": [
    {
      "name": "Example Name",
      "description": null,
      "due_at": null
    }
  ],
  "billing_type_details": [
    {
      "billing_type_id": 1,
      "currency": "USD",
      "amount": null,
      "contingency_rate": null,
      "billing_details_type": "primary"
    }
  ],
  "billing_types": [
    {
      "billing_type_id": 1,
      "billing_type_details": [
        {
          "currency": "USD",
          "amount": null,
          "contingency_rate": null,
          "billing_details_type": "primary"
        }
      ]
    }
  ],
  "access_types": [
    {
      "access_type": "public",
      "group_id": null,
      "user_id": null
    }
  ],
  "matter_users": [1],
  "matter_groups": [1],
  "form_input_types": [],
  "form_input_values": [],
  "matter_budget": {
    "amount": 1000.0,
    "currency": null,
    "budget_currency": null,
    "default_currency": null,
    "rate": null
  }
}
```

---

### 2.4 `createEvent` & `createAllDayEvent` (`POST /api/v1/calendar`)
Both `createEvent` (Lines 13–80) and `createAllDayEvent` (Lines 82–141) target the calendar creation endpoint. While the core fields align, several newer fields in the Postman schema are omitted or overridden:

| Field in Postman (`POST /api/v1/calendar`) | `createEvent` (`clientController.js`) | `createAllDayEvent` (`clientController.js`) | Status |
| :--- | :--- | :--- | :--- |
| `title` | `req.body.title` | `req.body.title` | **Same** |
| `start_datetime` | `req.body.start_datetime` | `req.body.start_datetime` | **Same** |
| `end_datetime` | `req.body.end_datetime` | `req.body.end_datetime` | **Same** |
| `description` | `` `${description} \npowered by Nuru` `` | `` `${description} \npowered by Nuru` `` | **Same** (Appends suffix) |
| `colour_code` | *(Omitted)* | *(Omitted)* | **Missing Optional** |
| `location` | `req.body.location` | *(Omitted)* | **Missing in All-Day** |
| `timezone` | `req.body.timezone` | *(Omitted)* | **Missing in All-Day** |
| `is_all_day` | `false` | `true` | **Same** |
| `sync_to_calendar` | *(Omitted)* | *(Omitted)* | **Missing (`false` in Postman)** |
| `recurrence_rule` | *(Omitted)* | *(Omitted)* | **Missing Optional** |
| `matter_id` | `null` (Hardcoded) | `null` (Hardcoded) | **Hardcoded `null`** |
| `user_id` | *(Omitted)* | *(Omitted)* | **Missing Optional** |
| `calendar_event_type_id` | *(Omitted)* | *(Omitted)* | **Missing Optional** |
| `visibility` | `"private"` (Ignores `req.body.visibility`) | `"private"` | **Hardcoded Override** |
| `status` | `"confirmed"` (Ignores `req.body.status`) | `"confirmed"` | **Hardcoded Override** |
| `event_type` | *(Omitted)* | *(Omitted)* | **Missing (`"hearing"` in Postman)** |
| `attendees` | `req.body.attendees` | *(Omitted)* | **Missing in All-Day** |
| `reminders` | `[{ method: "email", minutes: 60 }, { method: "popup", minutes: 15 }]` | `[{ method: "email", minutes: 1440 }]` | **Same** |

---

## 3. Additional Code & Architectural Findings in `clientController.js`

> [!WARNING]
> Beyond schema drift, the review identified several bugs in `clientController.js` and `clientRoutes.js` that will cause runtime failures:

1. **Unbound Variable `tenantId` in `isLoginSessionValid` (Lines 353–361)**:
   - Line 356 checks `if (!tenantId || tenantId === 'null')`, but `tenantId` is never declared in `isLoginSessionValid`. Calling `GET /hasValidToken` will immediately throw `ReferenceError: tenantId is not defined` and return HTTP 500.
2. **Commented-Out API Call in `createContact` (Lines 181–182)**:
   - Line 181 (`//const result = await apiRequest(...)`) is commented out and replaced with a hardcoded mock `const result = { status: 201, message: 'Contact has been created.' };`. No contacts are actually being persisted to the core service.
3. **Unsafe Array Indexing on Empty Search Results**:
   - In `searchCountries` (Lines 416–419, `result.data.data[0].id`) and `getContactIdByEmail` (Line 466, `result.data.data[0].id`), if the search query returns `0` matches (`data: []`), accessing `[0].id` without optional chaining (`?.[0]?.id`) throws a `TypeError: Cannot read properties of undefined (reading 'id')`, resulting in a `500 Internal Server Error` instead of a `404 Not Found`.
4. **Duplicate Route Registration (`GET /client` mapped to `createClient`)**:
   - In `src/routes/clientRoutes.js` (Lines 7–8), both `router.post('/client', clientController.createClient)` and `router.get('/client', clientController.createClient)` are registered. A `GET` request to `/client` will attempt to read `req.body` and trigger a `POST` creation call.
5. **Login Response Token Extraction Path**:
   - In `login` (Line 330), the token is extracted via `result.data.token.access_token`. In the Postman collection's `Login using Passport Personal Access Token` test script, the response structure is documented as `body.data.access_token` (or `body.access_token`). If the core API flattened the token response in v1, `result.data.token` will be `undefined`.

---

## 4. Implementation & Resolution Status (Completed 2026-11-06)

All schema discrepancies and runtime issues identified above have been resolved and verified via automated unit tests (`src/scripts/testClientController.js`) and HTTP smoke tests (`src/scripts/smokeTestCoreRoutes.js`):

1. **Version Prefix Alignment (`/api/v1`)**: Added `getCoreApiUrl(endpoint)` in `src/controllers/clientController.js` so all 12 upstream endpoints target `${BASE_URL}/api/v1/...` (with trailing-slash normalization on `BASE_URL`).
2. **Mutation Schema Alignment**:
   - `createEvent` & `createAllDayEvent` (`POST /api/v1/calendar`): Added support for `colour_code`, `sync_to_calendar`, `recurrence_rule`, `matter_id`, `user_id`, `calendar_event_type_id`, `event_type`, `visibility`, `status`, `attendees`, and `reminders`.
   - `createContact` (`POST /api/v1/contacts`): Uncommented the live `apiRequest` call, removed the mock response, and added support for dynamic `model_type` (default `"App\\Models\\Prospect"`), `model_id` (default `1`), `entity`, `entity_id`, and `include_in_emails`.
   - `createClient` (`POST /api/v1/clients`): Aligned to the Postman schema including nested `contact_data`, `tax_registrations`, `form_input_values`, and backward-compatible support for flat contact fields or existing `contact_id`.
   - `createMatter` (`POST /api/v1/matters`): Replaced legacy fields with the full `POST /api/v1/matters` schema (`client_id`, `name`, `practice_area_id`, `case_stage_id`, `billing_type_id`, `lawyer_assignments`, `limitation_statutes`, `billing_type_details`, `billing_types`, `access_types`, `matter_users`, `matter_groups`, `matter_budget`) and mounted `POST /matter` & `POST /matters` in `src/routes/clientRoutes.js`.
   - `createProspect` (`POST /api/v1/prospects`): Aligned to the Postman schema including nested `contact_data` and all optional root prospect attributes.
3. **Runtime Fixes & Guardrails**:
   - Fixed `isLoginSessionValid` `ReferenceError` by declaring `tenantId`.
   - Updated `login` token extraction to support `result.data?.data?.access_token || result.data?.access_token || result.data?.token?.access_token` and reject missing tokens with HTTP `401`.
   - Added null-safe optional chaining (`result.data?.data?.[0]?.id ?? null`) and `404` responses in `searchCountries` and `getContactIdByEmail`.
   - Consolidated duplicate lookup logic into `fetchLookupResource`.
   - Added Joi validation middleware (`src/middleware/validateClientRequest.js`) on all `POST` routes in `src/routes/clientRoutes.js`.
   - Fixed duplicate `paths:` key in `swagger.yaml` and documented `/v1/core/*` endpoints.


