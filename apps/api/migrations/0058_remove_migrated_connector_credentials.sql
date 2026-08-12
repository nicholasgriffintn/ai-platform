-- Composio is the credential authority for these providers. Remove the encrypted
-- credentials previously stored by the manual recipe connector implementation.
DELETE FROM `provider_connection`
WHERE `kind` = 'recipe_connector'
  AND `provider` IN (
    'asana',
    'calendar',
    'gmail',
    'linear',
    'notion',
    'outlook',
    'posthog',
    'sentry',
    'supabase',
    'todoist',
    'vercel',
    'webflow'
  );
