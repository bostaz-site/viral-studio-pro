-- Rebrand creator ranks: Newcomer/Creator/Trending/Viral/Elite/Legendary → Scout/Hunter/Alpha/Apex/Legend
-- Elite + Viral merged into Apex. Hidden Gem unchanged.

UPDATE social_accounts SET creator_rank = 'scout' WHERE creator_rank = 'newcomer';
UPDATE social_accounts SET creator_rank = 'hunter' WHERE creator_rank = 'creator';
UPDATE social_accounts SET creator_rank = 'alpha' WHERE creator_rank IN ('trending_creator', 'elite_creator');
UPDATE social_accounts SET creator_rank = 'apex' WHERE creator_rank = 'viral_creator';
UPDATE social_accounts SET creator_rank = 'legend' WHERE creator_rank = 'legendary';
-- hidden_gem stays as-is

-- Same for account_snapshots if it has this column
UPDATE account_snapshots SET creator_rank = 'scout' WHERE creator_rank = 'newcomer';
UPDATE account_snapshots SET creator_rank = 'hunter' WHERE creator_rank = 'creator';
UPDATE account_snapshots SET creator_rank = 'alpha' WHERE creator_rank IN ('trending_creator', 'elite_creator');
UPDATE account_snapshots SET creator_rank = 'apex' WHERE creator_rank = 'viral_creator';
UPDATE account_snapshots SET creator_rank = 'legend' WHERE creator_rank = 'legendary';
