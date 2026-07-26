-- Travel Buddy launch grant cleanup
-- Project: aleya travel assistant (jtktojbvbmiewpntpvhe)
-- Organisation: tasqkbrzxjralyelioyv (Aleya)

revoke execute on function public.storage_trip_id(text) from anon, public;
grant execute on function public.storage_trip_id(text) to authenticated, service_role;

revoke execute on function public.is_trip_member(uuid) from anon, public;
revoke execute on function public.can_edit_trip(uuid) from anon, public;
revoke execute on function public.trip_role(uuid) from anon, public;
grant execute on function public.is_trip_member(uuid) to authenticated, service_role;
grant execute on function public.can_edit_trip(uuid) to authenticated, service_role;
grant execute on function public.trip_role(uuid) to authenticated, service_role;
