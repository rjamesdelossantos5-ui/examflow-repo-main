-- EXAMFLOW migration — run in Supabase SQL Editor
-- Adds new document types: back of the ID, and the parent selfie (face check).
-- Run each ALTER on its own (ADD VALUE cannot run inside a transaction block).

alter type media_type add value if not exists 'parent_id_back';
alter type media_type add value if not exists 'parent_selfie';
