begin;

alter table videira.event_registrations
  add column checkout_reference uuid unique,
  add column expected_amount_cents integer check (expected_amount_cents > 0),
  add column mercado_pago_payment_id text unique,
  add column confirmation_code uuid unique,
  add column paid_at timestamptz,
  add constraint registration_payment_state check (
    (checkout_reference is null) = (expected_amount_cents is null)
    and (mercado_pago_payment_id is null) = (confirmation_code is null)
    and (paid_at is null) = (confirmation_code is null)
    and (confirmation_code is null or checkout_reference is not null)
  );

-- Call only after retrieving an approved BRL payment from Mercado Pago.
-- Public checkout returns and webhook bodies are not proof of payment.
create function public.videira_confirm_mercado_pago_registration(
  p_reference uuid,
  p_payment_id text,
  p_amount_cents integer
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  registration videira.event_registrations;
begin
  if p_payment_id is null or p_payment_id !~ '^[0-9]{1,30}$' then
    raise exception 'Identificador de pagamento inválido.';
  end if;

  select * into registration from videira.event_registrations
    where checkout_reference = p_reference for update;
  if not found or registration.expected_amount_cents is distinct from p_amount_cents then
    raise exception 'Pagamento incompatível com a inscrição.';
  end if;

  if registration.confirmation_code is not null then
    if registration.mercado_pago_payment_id is distinct from p_payment_id then
      raise exception 'A inscrição já possui outro pagamento confirmado.';
    end if;
    return registration.confirmation_code;
  end if;

  update videira.event_registrations
    set mercado_pago_payment_id = p_payment_id,
        confirmation_code = gen_random_uuid(),
        paid_at = now()
    where checkout_reference = p_reference
    returning confirmation_code into registration.confirmation_code;
  return registration.confirmation_code;
end;
$$;

revoke all on function public.videira_confirm_mercado_pago_registration(uuid,text,integer)
  from public,anon,authenticated;
grant execute on function public.videira_confirm_mercado_pago_registration(uuid,text,integer)
  to service_role;
commit;
