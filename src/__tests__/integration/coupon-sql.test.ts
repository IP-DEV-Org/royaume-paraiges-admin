/**
 * Tests d'integration SQL - Fonctions Supabase (Bonus Cashback)
 *
 * Ces tests documentent les requetes SQL a executer manuellement
 * via le MCP Supabase (execute_sql) ou le SQL Editor de Supabase.
 *
 * Ils ne sont PAS executes par Vitest. Ils servent de reference
 * pour valider le bon fonctionnement des fonctions PostgreSQL.
 *
 * Projet Supabase: kioysoveqemzjolfwpnu
 */

// ============================================================
// 1. Test credit_bonus_cashback()
// ============================================================

/**
 * SETUP: Identifier un utilisateur existant pour le test.
 *
 * ```sql
 * SELECT id, email, cashback_balance
 * FROM profiles
 * WHERE role = 'client'
 * LIMIT 1;
 * ```
 *
 * TEST: Creer un gain bonus cashback pour cet utilisateur.
 *
 * ```sql
 * SELECT credit_bonus_cashback(
 *   '<customer_id>'::UUID,
 *   500,                            -- 5,00 EUR
 *   NULL,                           -- pas de coupon source
 *   'bonus_cashback_manual'
 * );
 * ```
 *
 * VERIFICATION 1: Le gain est insere correctement.
 *
 * ```sql
 * SELECT id, customer_id, receipt_id, establishment_id, xp, cashback_money, source_type, coupon_id
 * FROM gains
 * WHERE customer_id = '<customer_id>'
 * ORDER BY created_at DESC
 * LIMIT 1;
 * ```
 *
 * Attendu:
 * - receipt_id = NULL
 * - establishment_id = NULL
 * - xp = 0
 * - cashback_money = 500
 * - source_type = 'bonus_cashback_manual'
 *
 * VERIFICATION 2: user_stats est mis a jour (apres refresh de la vue).
 *
 * ```sql
 * SELECT customer_id, total_cashback_earned
 * FROM user_stats
 * WHERE customer_id = '<customer_id>';
 * ```
 *
 * Attendu: total_cashback_earned a augmente de 500.
 *
 * NETTOYAGE:
 *
 * ```sql
 * DELETE FROM gains WHERE id = <gain_id_retourne>;
 * REFRESH MATERIALIZED VIEW CONCURRENTLY user_stats;
 * ```
 */

// ============================================================
// 2. Test validate_coupons()
// ============================================================

/**
 * SETUP: Creer des coupons de test (un montant fixe, un pourcentage).
 *
 * ```sql
 * -- Coupon montant fixe (deja used=true car bonus cashback)
 * INSERT INTO coupons (customer_id, amount, percentage, used, distribution_type, created_at)
 * VALUES ('<customer_id>', 500, NULL, true, 'manual', NOW())
 * RETURNING id;
 * -- → <coupon_amount_id>
 *
 * -- Coupon pourcentage (disponible)
 * INSERT INTO coupons (customer_id, amount, percentage, used, distribution_type, created_at, expires_at)
 * VALUES ('<customer_id>', NULL, 15, false, 'manual', NOW(), NOW() + INTERVAL '30 days')
 * RETURNING id;
 * -- → <coupon_pct_id>
 *
 * -- Coupon pourcentage deja utilise
 * INSERT INTO coupons (customer_id, amount, percentage, used, distribution_type, created_at)
 * VALUES ('<customer_id>', NULL, 10, true, 'manual', NOW())
 * RETURNING id;
 * -- → <coupon_used_id>
 * ```
 *
 * TEST 1: Valider un coupon montant fixe → doit echouer.
 *
 * ```sql
 * SELECT validate_coupons('<customer_id>'::UUID, ARRAY[<coupon_amount_id>]::BIGINT[]);
 * ```
 *
 * Attendu: Erreur ou rejet (coupon montant fixe non accepte).
 *
 * TEST 2: Valider un coupon pourcentage valide → doit reussir.
 *
 * ```sql
 * SELECT validate_coupons('<customer_id>'::UUID, ARRAY[<coupon_pct_id>]::BIGINT[]);
 * ```
 *
 * Attendu: Succes, retourne le total_percentage = 15.
 *
 * TEST 3: Valider un coupon deja utilise → doit echouer.
 *
 * ```sql
 * SELECT validate_coupons('<customer_id>'::UUID, ARRAY[<coupon_used_id>]::BIGINT[]);
 * ```
 *
 * Attendu: Erreur "Coupon deja utilise".
 *
 * NETTOYAGE:
 *
 * ```sql
 * DELETE FROM coupons WHERE id IN (<coupon_amount_id>, <coupon_pct_id>, <coupon_used_id>);
 * ```
 */

// ============================================================
// 3. Test get_customer_available_coupons()
// ============================================================

/**
 * SETUP: Reutiliser les coupons crees au test 2, ou en creer de nouveaux.
 *
 * ```sql
 * -- Coupon montant fixe (used=true, bonus cashback)
 * INSERT INTO coupons (customer_id, amount, percentage, used, distribution_type, created_at)
 * VALUES ('<customer_id>', 500, NULL, true, 'manual', NOW())
 * RETURNING id;
 * -- → <coupon_amount_id>
 *
 * -- Coupon pourcentage disponible
 * INSERT INTO coupons (customer_id, amount, percentage, used, distribution_type, created_at, expires_at)
 * VALUES ('<customer_id>', NULL, 15, false, 'manual', NOW(), NOW() + INTERVAL '30 days')
 * RETURNING id;
 * -- → <coupon_pct_id>
 *
 * -- Coupon pourcentage expire
 * INSERT INTO coupons (customer_id, amount, percentage, used, distribution_type, created_at, expires_at)
 * VALUES ('<customer_id>', NULL, 10, false, 'manual', NOW(), NOW() - INTERVAL '1 day')
 * RETURNING id;
 * -- → <coupon_expired_id>
 * ```
 *
 * TEST: Recuperer les coupons disponibles.
 *
 * ```sql
 * SELECT * FROM get_customer_available_coupons('<customer_id>'::UUID);
 * ```
 *
 * Attendu:
 * - Seul <coupon_pct_id> est retourne (pourcentage, non utilise, non expire)
 * - <coupon_amount_id> N'est PAS retourne (montant fixe → bonus cashback)
 * - <coupon_expired_id> N'est PAS retourne (expire)
 *
 * NETTOYAGE:
 *
 * ```sql
 * DELETE FROM coupons WHERE id IN (<coupon_amount_id>, <coupon_pct_id>, <coupon_expired_id>);
 * ```
 */

// ============================================================
// 4. Test create_receipt() avec coupon pourcentage
// ============================================================

/**
 * SETUP: Creer un coupon pourcentage pour le test.
 *
 * ```sql
 * INSERT INTO coupons (customer_id, amount, percentage, used, distribution_type, created_at, expires_at)
 * VALUES ('<customer_id>', NULL, 15, false, 'manual', NOW(), NOW() + INTERVAL '30 days')
 * RETURNING id;
 * -- → <coupon_pct_id>
 * ```
 *
 * Note: Ce test doit etre execute avec un role employee/establishment/admin
 * car create_receipt() verifie les permissions.
 *
 * TEST: Creer un receipt avec un coupon pourcentage.
 *
 * ```sql
 * SELECT create_receipt(
 *   '<customer_id>'::UUID,
 *   <establishment_id>::BIGINT,
 *   '[{"method": "card", "amount": 2000}]'::JSONB,
 *   ARRAY[<coupon_pct_id>]::BIGINT[]
 * );
 * ```
 *
 * VERIFICATION 1: Le montant paye = montant total (pas de reduction).
 *
 * ```sql
 * SELECT id, total_amount, payment_amount
 * FROM receipts
 * WHERE customer_id = '<customer_id>'
 * ORDER BY created_at DESC
 * LIMIT 1;
 * ```
 *
 * Attendu:
 * - total_amount = 2000
 * - payment_amount = 2000 (pas de reduction, le coupon % donne du bonus cashback)
 *
 * VERIFICATION 2: Le cashback bonus = total_amount * percentage / 100.
 *
 * ```sql
 * SELECT id, cashback_money, source_type
 * FROM gains
 * WHERE receipt_id = <receipt_id>
 * ORDER BY created_at DESC;
 * ```
 *
 * Attendu: cashback_money inclut le bonus coupon = 2000 * 15 / 100 = 300 centimes
 * (en plus du cashback normal du paiement card).
 *
 * VERIFICATION 3: Pas de receipt_lines avec payment_method='coupon'.
 *
 * ```sql
 * SELECT *
 * FROM receipt_lines
 * WHERE receipt_id = <receipt_id>;
 * ```
 *
 * Attendu: Aucune ligne avec payment_method = 'coupon'. Seule une ligne 'card' (2000).
 *
 * VERIFICATION 4: Le coupon est marque comme utilise.
 *
 * ```sql
 * SELECT id, used FROM coupons WHERE id = <coupon_pct_id>;
 * ```
 *
 * Attendu: used = true.
 *
 * NETTOYAGE (dans l'ordre pour respecter les FK):
 *
 * ```sql
 * DELETE FROM receipt_lines WHERE receipt_id = <receipt_id>;
 * DELETE FROM gains WHERE receipt_id = <receipt_id>;
 * DELETE FROM receipts WHERE id = <receipt_id>;
 * DELETE FROM coupons WHERE id = <coupon_pct_id>;
 * REFRESH MATERIALIZED VIEW CONCURRENTLY user_stats;
 * ```
 */
