-- Enforce related context for new/updated work without fabricating legacy identities.
-- NOT VALID preserves existing context-free rows for correction through normal editing.
alter table public.activities add constraint activities_related_context_required check (
  contact_id is not null or opportunity_id is not null or meeting_id is not null
  or coalesce(related_person_name,'') ~ '[^[:space:]]'
  or coalesce(related_organization_name,'') ~ '[^[:space:]]'
) not valid;
