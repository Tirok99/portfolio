-- ============================================================================
--  ONVORX — seed the CMS with the current site content (English).
--  Run once after schema.sql. UA (_uk) fields stay empty until translated;
--  the build step falls back to EN for any missing UA value.
-- ============================================================================

insert into public.site_content (id,
  hero_eyebrow_en, hero_title_en, hero_description_en, hero_cta_en,
  services_eyebrow_en, services_title_en, services_description_en,
  projects_eyebrow_en, projects_title_en, projects_lede_en,
  howwork_eyebrow_en, howwork_title_en, howwork_description_en,
  about_eyebrow_en, about_title_en, about_description_en,
  cta_eyebrow_en, cta_title_en, cta_description_en, cta_button_en,
  footer_tagline_en, contact_email, contact_telegram, contact_telegram_href, footer_copyright
) values (1,
  'Web-development & business-analysis',
  'Web solutions built around your business requirements',
  'ONVORX helps B2B companies plan, build and grow websites and digital solutions — from formalizing requirements and implementation through to ongoing support.',
  'Request an Estimate',

  'Services',
  'From requirements to implementation and ongoing development',
  'ONVORX can join a project at different stages — from defining requirements and building a new website to developing an existing solution and supporting further growth.',

  'Selected projects',
  'Selected work in web development',
  'We build web solutions that solve real business challenges. Here are some of our recent projects.',

  'How we work',
  'A clear path from task to implementation',
  'ONVORX can join a project at the stage where support is needed — from clarifying requirements to implementation and further development.',

  'About ONVORX',
  'Practical experience behind every project',
  'ONVORX combines hands-on web development experience with a structured approach to requirements, implementation and ongoing development.',

  'Start a project',
  'Let’s turn your requirements into a working solution',
  'Tell us what you’re planning, what already exists and where support is needed. ONVORX will review the requirements and clarify what’s needed to prepare a project estimate.',
  'Request a Project Estimate',

  'Web solutions built around your business requirements. From idea to implementation and beyond.',
  'info@onvorx.com',
  't.me/onvorx',
  'https://t.me/onvorx',
  '© 2026 | ONVORX | All Rights Reserved'
)
on conflict (id) do nothing;

insert into public.services (slug, sort, featured, title_en, text_en) values
  ('web-development',   1, true,  'Web Development',
   'Build a new website from ready designs and requirements, with structure and UX/UI support when needed.'),
  ('support',          2, false, 'Website Support & Development',
   'Improve and extend an existing WordPress or Horoshop website with new pages, functionality, integrations and ongoing support.'),
  ('business-analysis', 3, false, 'Business Analysis',
   'Clarify business processes, scope and requirements before automation or software development begins.'),
  ('google-ads',       4, false, 'Google Ads',
   'Set up and manage Google Ads campaigns as a separate channel for attracting relevant paid traffic.')
on conflict (slug) do nothing;

insert into public.projects (slug, sort, index_label, title_en, tags, text_en, image_url, image_alt_en) values
  ('relax-ahill', 1, '01', 'Relax Ahill',
   array['WordPress','WooCommerce','Google Ads'],
   'Website implementation and ongoing digital growth support.',
   '/assets/projects/relax-ahill.png',
   'Relax Ahill website shown on a laptop'),
  ('encryptia-cloud', 2, '02', 'Encryptia Cloud',
   array['WordPress'],
   'Website implementation for a cloud-focused business.',
   '/assets/projects/encryptia-cloud.png',
   'Encryptia Cloud website shown on a laptop')
on conflict (slug) do nothing;
