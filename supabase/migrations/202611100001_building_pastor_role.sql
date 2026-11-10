-- Separate transaction: the enum must commit before use. No access is granted by this statement.
alter type videira.leadership_role add value if not exists 'predio';
