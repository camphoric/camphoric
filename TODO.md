# TODO / Feature Backlog

- [ ] Create a way to pre-sign waiver for each camper, make sure to allow parents to sign on behalf of minors
- [ ] Create a way to have "plugins", which allow for api code, and have a table attached about plugins attached to events, and a spot in the table where the plugin can store data in JSON format (one column only)
- [ ] Auto-generate the frontend API types from the backend instead of hand-maintaining them: add `drf-spectacular` to the Django backend to emit an OpenAPI schema, then generate the client's TypeScript types from it with `openapi-typescript` (run in CI so they can't drift from the serializers). The bespoke endpoints (register/payment bundle, report render) need `@extend_schema` annotations; JSON fields land as `unknown`. Needs a backend change, so coordinate with the backend (do not change the api without explicit permission). Replaces the hand-maintained API types described in SPEC_CLIENT_V2.md §5 / DR-27.
- [ ] Add ability to customize error messages for RJSF input types
# - [ ] Change the way that attributes / admin_attributes are stored. We want to move to a model where all attribute definitions are in a JSON object with the following structure. Also we'll need an additional way to determine attribute order in the forms
```
{
  <attribute machine name>: {
    type: "value",
    schema: <json schema>,
    uiSchema: <json ui schema for rjsf>,
    isAdmin: <whether this shows up for registering campers>,
  }
  // also groups, which are objects which contain a sub-schema
  <attribute group name>: {
    type: "group",
    children: <array of attribute machine names>,
    uiSchema: <json ui schema for rjsf>,
    isAdmin: <whether this shows up for registering campers>,
  }
}
```

