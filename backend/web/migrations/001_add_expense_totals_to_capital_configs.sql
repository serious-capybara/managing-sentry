ALTER TABLE public.capital_configs
    ADD COLUMN IF NOT EXISTS operating_expenses numeric(12, 2) NOT NULL DEFAULT 0
        CHECK (operating_expenses >= 0),
    ADD COLUMN IF NOT EXISTS interest numeric(12, 2) NOT NULL DEFAULT 0
        CHECK (interest >= 0),
    ADD COLUMN IF NOT EXISTS taxes numeric(12, 2) NOT NULL DEFAULT 0
        CHECK (taxes >= 0);
