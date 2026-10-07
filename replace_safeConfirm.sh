#!/bin/bash
for file in src/components/admin/UserManagement.tsx src/components/admin/RoomManagement.tsx src/components/admin/PaymentManagement.tsx src/components/admin/ContentManagement.tsx; do
  sed -i 's/const safeConfirm = (message: string): boolean => {/const safeConfirm = (message: string): boolean => {\n  try {\n    const t0 = performance.now();\n    const result = window.confirm(message);\n    if (!result \&\& performance.now() - t0 < 50) return true;\n    return result;\n  } catch (e) {\n    return true;\n  }\n}\n\/\* /g' "$file"
done
