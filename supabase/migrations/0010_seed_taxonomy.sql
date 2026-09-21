-- Bootstrap the open skills/interests taxonomy so onboarding isn't a blank
-- text box on day one. Anyone can still add more (see 0009_policies.sql).

insert into public.skills (slug, label, category) values
  ('carpentry', 'Carpentry', 'trades'),
  ('plumbing', 'Plumbing', 'trades'),
  ('electrical', 'Electrical work', 'trades'),
  ('gardening', 'Gardening', 'outdoors'),
  ('cooking', 'Cooking', 'life'),
  ('childcare', 'Childcare', 'life'),
  ('tutoring_math', 'Math tutoring', 'education'),
  ('tutoring_language', 'Language tutoring', 'education'),
  ('graphic_design', 'Graphic design', 'creative'),
  ('photography', 'Photography', 'creative'),
  ('video_editing', 'Video editing', 'creative'),
  ('web_development', 'Web development', 'tech'),
  ('first_aid', 'First aid', 'health'),
  ('counseling', 'Peer counseling', 'health'),
  ('moving_help', 'Moving / heavy lifting', 'life'),
  ('driving', 'Driving / errands', 'life'),
  ('legal_advice', 'Legal advice', 'professional'),
  ('accounting', 'Accounting', 'professional'),
  ('spanish', 'Spanish', 'language'),
  ('portuguese', 'Portuguese', 'language');

insert into public.interests (slug, label, category) values
  ('community', 'Community', 'social'),
  ('creative', 'Creative', 'social'),
  ('outdoors', 'Outdoors', 'social'),
  ('learning', 'Learning', 'social'),
  ('building', 'Building', 'social'),
  ('sports', 'Sports', 'social'),
  ('volunteering', 'Volunteering', 'social'),
  ('hiking', 'Hiking', 'outdoors'),
  ('music', 'Music', 'creative'),
  ('parenting', 'Parenting', 'life'),
  ('entrepreneurship', 'Entrepreneurship', 'professional'),
  ('cycling', 'Cycling', 'sports');
