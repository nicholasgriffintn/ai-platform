-- Custom SQL migration file, put your code below! --
-- Function tools were auto-registered as dynamic apps, so projects could attach one as an
-- `app` capability. Only the curated FEATURED_APPS ids are apps now, and every other id
-- resolves to nothing. Function tools remain available to projects as `tool` capabilities.
DELETE FROM `project_capability`
WHERE `kind` = 'app'
  AND `capability_id` NOT IN (
    'featured-strudel',
    'featured-replicate',
    'featured-finetuning',
    'featured-podcast-processor',
    'featured-article-processor',
    'featured-note-taker'
  );
