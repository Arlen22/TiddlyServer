git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch lib/compiled-lib.js" \
  --prune-empty --tag-name-filter cat -- --all