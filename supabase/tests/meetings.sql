-- Requires synthetic fixtures from rls_foundation.sql in the current transaction.
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-0000-0000-000000000006',true);
do $$ declare payload jsonb; result jsonb; rejected boolean; person_uuid uuid; before_count integer; begin
 select jsonb_agg(jsonb_build_object('person_id',id,'present',true)),min(id::text)::uuid into payload,person_uuid from videira.people where cell_id='40000000-0000-0000-0000-000000000001';
 result=videira.record_meeting('40000000-0000-0000-0000-000000000001','2026-10-01',payload);
 if (result->>'converted')::int<>0 then raise exception 'FAIL converted after first meeting'; end if;
 result=videira.record_meeting('40000000-0000-0000-0000-000000000001','2026-10-08',payload);
 if (result->>'converted')::int<>0 then raise exception 'FAIL converted after second meeting'; end if;
 result=videira.record_meeting('40000000-0000-0000-0000-000000000001','2026-10-15',payload);
 if (result->>'converted')::int<>1 or (select category from videira.people where id=person_uuid)<>'Membro' then raise exception 'FAIL third meeting conversion'; end if;
 update videira.people set category='Visitante' where id=person_uuid;
 result=videira.record_meeting('40000000-0000-0000-0000-000000000001','2026-10-22',jsonb_build_array(jsonb_build_object('person_id',person_uuid,'present',false)));
 result=videira.record_meeting('40000000-0000-0000-0000-000000000001','2026-10-29',payload);
 result=videira.record_meeting('40000000-0000-0000-0000-000000000001','2026-11-05',payload);
 if (result->>'converted')::int<>0 then raise exception 'FAIL absence did not reset sequence'; end if;
 result=videira.record_meeting('40000000-0000-0000-0000-000000000001','2026-11-06',payload);
 if (result->>'converted')::int<>1 then raise exception 'FAIL conversion after absence and three new presences'; end if;
 select count(*) into before_count from videira.meetings;
 rejected=false;begin perform videira.record_meeting('40000000-0000-0000-0000-000000000001','2026-11-06',payload);exception when raise_exception then rejected=true;end;
 if not rejected then raise exception 'FAIL duplicate date accepted'; end if;
 rejected=false;begin perform videira.record_meeting('40000000-0000-0000-0000-000000000001',current_date+1,payload);exception when raise_exception then rejected=true;end;
 if not rejected then raise exception 'FAIL future date accepted'; end if;
 rejected=false;begin perform videira.record_meeting('40000000-0000-0000-0000-000000000002','2026-11-06',payload);exception when insufficient_privilege then rejected=true;end;
 if not rejected then raise exception 'FAIL cross-cell write accepted'; end if;
 if (select count(*) from videira.meetings)<>before_count then raise exception 'FAIL rejected meeting persisted'; end if;
 begin insert into videira.audit_log(organization_id,action,entity) values('10000000-0000-0000-0000-000000000001','spoof','test');raise exception 'FAIL client audit write allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from videira.audit_log where entity='meetings' and actor_id='90000000-0000-0000-0000-000000000006') then raise exception 'FAIL meeting audit missing'; end if;
end $$;
select 'PASS: atomic attendance, three consecutive meetings, absence reset, rejected duplicates/future/cross-cell, protected audit' as meeting_test;
