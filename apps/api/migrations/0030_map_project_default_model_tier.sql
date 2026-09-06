UPDATE `project` SET `default_model_tier` = CASE `default_router_mode` WHEN 'lite' THEN 'low' WHEN 'standard' THEN 'medium' WHEN 'pro' THEN 'high' WHEN 'max' THEN 'ultra' ELSE NULL END;
