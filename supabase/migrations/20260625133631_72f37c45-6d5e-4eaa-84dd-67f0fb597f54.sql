-- Strip super_admin from any account that is not the protected owner email
DELETE FROM public.user_roles ur
USING auth.users u
WHERE ur.user_id = u.id
  AND ur.role = 'super_admin'
  AND lower(u.email) <> 'abdulazizalodan1@gmail.com';