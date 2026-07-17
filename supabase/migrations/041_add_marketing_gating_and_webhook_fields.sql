-- Add use_marketing_endpoint to whatsapp_config
ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS use_marketing_endpoint BOOLEAN DEFAULT FALSE;

-- Add hmac_secret and default_phone_prefix to webhook_integrations
ALTER TABLE webhook_integrations ADD COLUMN IF NOT EXISTS hmac_secret TEXT DEFAULT NULL;
ALTER TABLE webhook_integrations ADD COLUMN IF NOT EXISTS default_phone_prefix TEXT DEFAULT '91';
