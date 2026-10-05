ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS base_cost numeric(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS expiration_date date,
    ADD COLUMN IF NOT EXISTS stock_baseline integer,
    ADD COLUMN IF NOT EXISTS low_stock_alert_level integer NOT NULL DEFAULT 5;

UPDATE public.products
SET stock_baseline = stock_quantity
WHERE stock_baseline IS NULL;

ALTER TABLE public.products
    ALTER COLUMN stock_baseline SET DEFAULT 0,
    ALTER COLUMN stock_baseline SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.product_expiry_batches (
    batch_id bigserial PRIMARY KEY,
    product_id integer NOT NULL REFERENCES public.products(product_id) ON DELETE CASCADE,
    expiry_date date NOT NULL,
    quantity integer NOT NULL CHECK (quantity > 0),
    added_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, expiry_date)
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
    movement_id bigserial PRIMARY KEY,
    product_id integer REFERENCES public.products(product_id) ON DELETE SET NULL,
    product_name character varying(150) NOT NULL,
    movement_type character varying(20) NOT NULL
        CHECK (movement_type IN ('PRODUCT ADD', 'PRODUCT DELETE', 'STOCK IN', 'STOCK OUT')),
    quantity integer NOT NULL CHECK (quantity >= 0),
    unit_cost numeric(10,2) NOT NULL DEFAULT 0,
    reference text NOT NULL DEFAULT '',
    notes text NOT NULL DEFAULT '',
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS transaction_id character varying(32),
    ADD COLUMN IF NOT EXISTS product_name character varying(150),
    ADD COLUMN IF NOT EXISTS unit_price numeric(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cost_per_unit numeric(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payment_method character varying(50) NOT NULL DEFAULT 'Cash',
    ADD COLUMN IF NOT EXISTS payment_reference text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS amount_received numeric(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS change_given numeric(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';

UPDATE public.sales s
SET product_name = p.name,
    unit_price = CASE WHEN s.quantity > 0 THEN s.total_amount / s.quantity ELSE 0 END
FROM public.products p
WHERE p.product_id = s.product_id
  AND s.product_name IS NULL;

ALTER TABLE public.sales
    ALTER COLUMN product_name SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.dashboard_settings (
    setting_key character varying(50) PRIMARY KEY,
    setting_value numeric(12,2) NOT NULL
);

INSERT INTO public.dashboard_settings (setting_key, setting_value)
VALUES ('capital', 20000)
ON CONFLICT (setting_key) DO NOTHING;
