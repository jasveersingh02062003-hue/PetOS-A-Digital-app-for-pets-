const fs = require('fs');
let txt = fs.readFileSync('supabase/clean_schema.sql', 'utf8');

// Regex to find all storage.objects policies, allowing newlines
const regex = /CREATE POLICY "([^"]+)"\s*ON\s+storage\.objects/g;

txt = txt.replace(regex, (match, p1) => {
    // If it already has DROP POLICY IF EXISTS right before it, don't duplicate
    return `DROP POLICY IF EXISTS "${p1}" ON storage.objects;\n${match}`;
});

// Remove duplicates if any
txt = txt.replace(/DROP POLICY IF EXISTS "([^"]+)" ON storage\.objects;\nDROP POLICY IF EXISTS "\1" ON storage\.objects;/g, 'DROP POLICY IF EXISTS "$1" ON storage.objects;');

fs.writeFileSync('supabase/clean_schema.sql', txt);
console.log('Done with newlines!');
