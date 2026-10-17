--
-- PostgreSQL database dump
--

\restrict oYIczkb4HDdKF3ejs8GdD2By88ZrRwss5TaUKmadl9U9ozEWyGwen3vKwXvWq0K

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.6

-- Started on 2026-10-15 06:50:35 PST

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 25 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 3916 (class 0 OID 0)
-- Dependencies: 25
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 1247 (class 1247 OID 18495)
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'Admin',
    'Manager',
    'Staff'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- TOC entry 412 (class 1255 OID 17488)
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 389 (class 1259 OID 18510)
-- Name: capital_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.capital_configs (
    config_id integer NOT NULL,
    starting_capital numeric(12,2) NOT NULL,
    current_balance numeric(12,2) NOT NULL,
    last_updated_at timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text) NOT NULL
);


ALTER TABLE public.capital_configs OWNER TO postgres;

--
-- TOC entry 388 (class 1259 OID 18509)
-- Name: capital_configs_config_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.capital_configs ALTER COLUMN config_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.capital_configs_config_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 399 (class 1259 OID 18576)
-- Name: histories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.histories (
    history_id integer NOT NULL,
    order_id integer NOT NULL,
    status_timestamp timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text) NOT NULL,
    order_status character varying(20) DEFAULT 'COMPLETED'::character varying NOT NULL
);


ALTER TABLE public.histories OWNER TO postgres;

--
-- TOC entry 398 (class 1259 OID 18575)
-- Name: histories_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.histories ALTER COLUMN history_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.histories_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 395 (class 1259 OID 18540)
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    order_item_id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    cost_snapshot numeric(10,2) NOT NULL,
    price_snapshot numeric(10,2) NOT NULL,
    line_subtotal numeric(10,2) NOT NULL,
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- TOC entry 394 (class 1259 OID 18539)
-- Name: order_items_order_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.order_items ALTER COLUMN order_item_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.order_items_order_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 393 (class 1259 OID 18525)
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    order_id integer NOT NULL,
    user_id integer NOT NULL,
    transaction_timestamp timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text) NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    amount_tendered numeric(10,2) NOT NULL,
    change_given numeric(10,2) NOT NULL,
    notes text,
    CONSTRAINT orders_total_amount_check CHECK ((total_amount >= (0)::numeric))
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- TOC entry 392 (class 1259 OID 18524)
-- Name: orders_order_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.orders ALTER COLUMN order_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.orders_order_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 391 (class 1259 OID 18517)
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    product_id integer NOT NULL,
    name character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    base_cost numeric(10,2) NOT NULL,
    markup_amount numeric(10,2) NOT NULL,
    retail_price numeric(10,2) NOT NULL,
    stock_quantity integer DEFAULT 0 NOT NULL,
    expiration_date date,
    low_stock_alert_level integer DEFAULT 20 NOT NULL
);


ALTER TABLE public.products OWNER TO postgres;

--
-- TOC entry 390 (class 1259 OID 18516)
-- Name: products_product_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.products ALTER COLUMN product_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.products_product_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 397 (class 1259 OID 18559)
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_adjustments (
    adjustment_id integer NOT NULL,
    product_id integer NOT NULL,
    user_id integer NOT NULL,
    adjustment_type character varying(30) NOT NULL,
    quantity_changed integer NOT NULL,
    unit_cost numeric(10,2),
    transaction_date timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text) NOT NULL,
    audit_notes character varying(255)
);


ALTER TABLE public.stock_adjustments OWNER TO postgres;

--
-- TOC entry 396 (class 1259 OID 18558)
-- Name: stock_adjustments_adjustment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_adjustments ALTER COLUMN adjustment_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.stock_adjustments_adjustment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 387 (class 1259 OID 18502)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    full_name character varying(100) NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role public.user_role NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 386 (class 1259 OID 18501)
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.users ALTER COLUMN user_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.users_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 3900 (class 0 OID 18510)
-- Dependencies: 389
-- Data for Name: capital_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.capital_configs OVERRIDING SYSTEM VALUE VALUES (1, 50000.00, 80737.00, '2026-10-15 05:47:54.204707');


--
-- TOC entry 3910 (class 0 OID 18576)
-- Dependencies: 399
-- Data for Name: histories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (1, 1, '2026-09-13 21:40:19.414626', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (2, 2, '2026-09-14 14:41:16.110696', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (3, 3, '2026-09-14 15:00:27.001777', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (4, 4, '2026-09-14 15:00:59.382545', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (5, 5, '2026-09-14 15:02:33.888411', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (6, 6, '2026-09-14 15:48:52.960411', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (7, 7, '2026-09-16 11:15:44.44384', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (8, 8, '2026-09-16 11:16:52.12506', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (9, 9, '2026-09-16 11:16:52.136017', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (10, 10, '2026-09-17 20:19:44.69911', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (11, 11, '2026-09-17 20:19:44.765639', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (12, 12, '2026-09-18 21:00:05.71289', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (13, 13, '2026-09-18 21:24:03.192654', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (14, 14, '2026-09-18 22:56:13.917552', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (15, 15, '2026-10-05 18:10:43.815354', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (16, 16, '2026-10-05 18:16:32.369515', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (17, 17, '2026-10-05 18:27:30.956886', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (18, 18, '2026-10-07 12:03:17.935016', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (19, 19, '2026-10-07 12:30:39.987025', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (20, 20, '2026-10-07 15:00:53.679132', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (21, 21, '2026-10-07 16:02:32.757277', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (22, 22, '2026-10-10 21:54:29.986379', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (23, 23, '2026-10-10 21:54:54.829069', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (24, 24, '2026-10-10 21:55:43.605562', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (25, 25, '2026-10-11 00:29:52.208086', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (26, 26, '2026-10-11 19:42:59.079416', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (27, 27, '2026-10-11 19:42:59.092883', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (28, 28, '2026-10-11 21:45:39.982447', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (29, 29, '2026-10-11 23:46:08.962145', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (30, 30, '2026-10-12 12:26:27.625325', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (31, 31, '2026-10-12 12:27:08.524644', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (32, 32, '2026-10-12 12:29:51.457067', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (33, 33, '2026-10-12 06:48:18.207573', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (34, 34, '2026-10-12 07:02:44.685365', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (35, 35, '2026-10-12 07:19:41.560149', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (36, 36, '2026-10-12 07:24:06.333389', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (37, 37, '2026-10-12 08:26:44.48748', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (38, 38, '2026-10-12 08:27:57.384075', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (39, 39, '2026-10-12 08:47:06.127113', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (40, 40, '2026-10-12 08:49:22.366642', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (41, 41, '2026-10-12 18:25:40.584862', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (42, 42, '2026-10-12 18:26:24.720097', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (43, 43, '2026-10-13 12:42:45.307733', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (44, 44, '2026-10-13 07:58:08.523385', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (45, 45, '2026-10-13 16:02:21.886642', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (46, 46, '2026-10-13 16:03:25.617762', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (47, 47, '2026-10-13 16:42:01.760574', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (48, 48, '2026-10-14 11:06:35.545436', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (49, 49, '2026-10-14 15:16:41.89182', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (50, 50, '2026-10-15 03:40:33.215553', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (51, 51, '2026-10-15 05:17:16.196451', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (52, 52, '2026-10-15 05:17:39.722808', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (53, 53, '2026-10-15 05:25:41.025374', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (54, 54, '2026-10-15 05:41:56.588297', 'COMPLETED');
INSERT INTO public.histories OVERRIDING SYSTEM VALUE VALUES (55, 55, '2026-10-15 05:47:54.204707', 'COMPLETED');


--
-- TOC entry 3906 (class 0 OID 18540)
-- Dependencies: 395
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (1, 1, 6, 2, 52.50, 75.00, 150.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (2, 2, 2, 3, 4.20, 6.00, 18.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (3, 2, 5, 1, 5.60, 8.00, 8.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (4, 2, 9, 1, 45.50, 65.00, 65.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (5, 3, 2, 7, 4.20, 6.00, 42.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (6, 4, 2, 2, 4.20, 6.00, 12.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (7, 5, 2, 3, 4.20, 6.00, 18.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (8, 6, 9, 3, 45.50, 65.00, 195.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (9, 7, 7, 4, 80.50, 115.00, 460.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (10, 8, 7, 1, 80.50, 115.00, 115.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (11, 9, 7, 1, 80.50, 115.00, 115.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (12, 10, 1, 2, 3.85, 5.50, 11.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (13, 11, 2, 4, 4.20, 6.00, 24.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (14, 12, 1, 1, 3.85, 5.50, 5.50);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (15, 12, 2, 1, 4.20, 6.00, 6.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (16, 12, 3, 1, 33.60, 48.00, 48.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (17, 12, 5, 1, 5.60, 8.00, 8.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (18, 12, 6, 1, 52.50, 75.00, 75.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (19, 12, 7, 1, 80.50, 115.00, 115.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (20, 12, 8, 1, 26.60, 38.00, 38.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (21, 12, 9, 1, 45.50, 65.00, 65.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (22, 12, 10, 1, 5.25, 7.50, 7.50);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (23, 13, 2, 1, 4.20, 6.00, 6.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (24, 13, 5, 1, 5.60, 8.00, 8.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (25, 13, 6, 1, 52.50, 75.00, 75.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (26, 14, 2, 1, 4.20, 6.00, 6.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (27, 14, 5, 1, 5.60, 8.00, 8.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (28, 14, 6, 1, 52.50, 75.00, 75.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (29, 15, 1, 7, 3.85, 5.50, 38.50);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (30, 16, 1, 7, 3.85, 5.50, 38.50);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (31, 17, 20, 2, 6.30, 9.00, 18.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (32, 18, 54, 2, 18.20, 26.00, 52.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (33, 18, 61, 3, 12.60, 18.00, 54.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (34, 19, 17, 5, 29.40, 42.00, 210.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (36, 20, 54, 6, 18.20, 26.00, 156.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (37, 20, 50, 52, 33.60, 48.00, 2496.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (38, 20, 27, 25, 25.20, 36.00, 900.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (39, 20, 21, 30, 84.00, 120.00, 3600.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (40, 21, 54, 2, 18.20, 26.00, 52.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (41, 21, 51, 12, 9.80, 14.00, 168.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (42, 22, 38, 2, 15.40, 22.00, 44.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (43, 22, 29, 1, 19.60, 28.00, 28.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (44, 22, 51, 1, 9.80, 14.00, 14.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (45, 23, 7, 1, 80.50, 115.00, 115.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (46, 23, 14, 3, 7.00, 10.00, 30.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (47, 23, 61, 1, 12.60, 18.00, 18.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (48, 24, 50, 3, 33.60, 48.00, 144.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (49, 24, 61, 2, 12.60, 18.00, 36.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (50, 24, 17, 1, 29.40, 42.00, 42.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (51, 25, 2, 1, 4.20, 6.00, 6.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (52, 25, 22, 1, 15.40, 22.00, 22.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (53, 25, 37, 1, 17.50, 25.00, 25.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (54, 25, 70, 1, 24.50, 35.00, 35.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (55, 26, 2, 1, 4.20, 6.00, 6.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (56, 27, 2, 1, 4.20, 6.00, 6.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (57, 26, 22, 1, 15.40, 22.00, 22.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (58, 26, 37, 1, 17.50, 25.00, 25.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (59, 26, 70, 1, 24.50, 35.00, 35.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (60, 27, 22, 1, 15.40, 22.00, 22.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (61, 27, 37, 1, 17.50, 25.00, 25.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (62, 27, 70, 1, 24.50, 35.00, 35.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (63, 28, 50, 3, 33.60, 48.00, 144.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (64, 29, 61, 3, 12.60, 18.00, 54.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (65, 30, 43, 2, 8.40, 12.00, 24.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (66, 30, 23, 1, 8.40, 12.00, 12.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (67, 30, 42, 2, 8.40, 12.00, 24.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (68, 31, 6, 10, 52.50, 75.00, 750.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (69, 32, 39, 2, 10.50, 15.00, 30.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (70, 32, 23, 1, 8.40, 12.00, 12.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (71, 32, 42, 1, 8.40, 12.00, 12.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (72, 32, 13, 1, 7.00, 10.00, 10.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (73, 32, 43, 2, 8.40, 12.00, 24.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (74, 33, 61, 4, 12.60, 18.00, 72.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (75, 33, 17, 3, 29.40, 42.00, 126.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (76, 34, 74, 3, 540.00, 600.00, 1800.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (77, 35, 54, 5, 18.20, 26.00, 130.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (78, 36, 74, 7, 540.00, 600.00, 4200.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (79, 37, 54, 4, 18.20, 26.00, 104.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (80, 37, 74, 2, 540.00, 600.00, 1200.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (81, 38, 61, 67, 12.60, 18.00, 1206.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (82, 39, 61, 3, 12.60, 18.00, 54.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (83, 40, 74, 8, 540.00, 550.00, 4400.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (84, 41, 74, 5, 540.00, 550.00, 2750.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (85, 42, 17, 3, 29.40, 42.00, 126.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (86, 43, 74, 5, 540.00, 550.00, 2750.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (87, 44, 54, 3, 18.20, 26.00, 78.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (88, 45, 54, 2, 18.20, 26.00, 52.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (89, 46, 61, 1, 12.60, 18.00, 18.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (90, 46, 50, 1, 33.60, 48.00, 48.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (91, 47, 14, 2, 7.00, 10.00, 20.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (92, 47, 17, 5, 29.40, 42.00, 210.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (93, 48, 74, 3, 540.00, 550.00, 1650.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (94, 49, 54, 1, 18.20, 26.00, 26.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (95, 50, 58, 1, 22.40, 32.00, 32.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (96, 51, 74, 9, 540.00, 550.00, 4950.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (97, 52, 54, 1, 18.20, 26.00, 26.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (98, 53, 54, 1, 18.20, 26.00, 26.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (99, 54, 50, 1, 33.60, 48.00, 48.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (100, 55, 61, 3, 12.60, 18.00, 54.00);
INSERT INTO public.order_items OVERRIDING SYSTEM VALUE VALUES (101, 55, 74, 5, 540.00, 550.00, 2750.00);


--
-- TOC entry 3904 (class 0 OID 18525)
-- Dependencies: 393
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (1, 4, '2026-09-13 21:40:19.414626', 150.00, 200.00, 50.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (2, 4, '2026-09-14 14:41:16.110696', 91.00, 91.00, 0.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (3, 4, '2026-09-14 15:00:27.001777', 42.00, 100.00, 58.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (4, 4, '2026-09-14 15:00:59.382545', 12.00, 20.00, 8.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (5, 4, '2026-09-14 15:02:33.888411', 18.00, 20.00, 2.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (6, 4, '2026-09-14 15:48:52.960411', 195.00, 200.00, 5.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (7, 4, '2026-09-16 11:15:44.44384', 460.00, 500.00, 40.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (8, 4, '2026-09-16 11:16:52.12506', 115.00, 120.00, 5.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (9, 4, '2026-09-16 11:16:52.136017', 115.00, 120.00, 5.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (10, 1, '2026-09-17 20:19:44.69911', 11.00, 15.00, 4.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (11, 1, '2026-09-17 20:19:44.765639', 24.00, 25.00, 1.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (12, 1, '2026-09-18 21:00:05.71289', 368.00, 400.00, 32.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (13, 1, '2026-09-18 21:24:03.192654', 89.00, 50.00, -39.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (14, 1, '2026-09-18 22:56:13.917552', 89.00, 80.00, -9.00, 'fgihcg');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (15, 4, '2026-10-05 18:10:43.815354', 38.50, 40.00, 1.50, '');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (16, 4, '2026-10-05 18:16:32.369515', 38.50, 40.00, 1.50, '');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (17, 1, '2026-10-05 18:27:30.956886', 18.00, 20.00, 2.00, '');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (18, 4, '2026-10-07 12:03:17.935016', 106.00, 120.00, 14.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (19, 4, '2026-10-07 12:30:39.987025', 210.00, 500.00, 290.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (20, 4, '2026-10-07 15:00:53.679132', 7427.00, 8000.00, 573.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (21, 4, '2026-10-07 16:02:32.757277', 220.00, 300.00, 80.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (22, 1, '2026-10-10 21:54:29.986379', 86.00, 100.00, 14.00, '');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (23, 1, '2026-10-10 21:54:54.829069', 163.00, 200.00, 37.00, 'ahem');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (24, 1, '2026-10-10 21:55:43.605562', 222.00, 300.00, 78.00, '');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (25, 1, '2026-10-11 00:29:52.208086', 88.00, 100.00, 12.00, 'meow');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (26, 1, '2026-10-11 19:42:59.079416', 88.00, 100.00, 12.00, 'meow');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (27, 1, '2026-10-11 19:42:59.092883', 88.00, 100.00, 12.00, 'meow');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (28, 1, '2026-10-11 21:45:39.982447', 144.00, 150.00, 6.00, '');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (29, 1, '2026-10-11 23:46:08.962145', 54.00, 100.00, 46.00, '');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (30, 1, '2026-10-12 12:26:27.625325', 60.00, 100.00, 40.00, '');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (31, 1, '2026-10-12 12:27:08.524644', 750.00, 800.00, 50.00, '');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (32, 1, '2026-10-12 12:29:51.457067', 88.00, 100.00, 12.00, '');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (33, 1, '2026-10-12 06:48:18.207573', 198.00, 200.00, 2.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (34, 1, '2026-10-12 07:02:44.685365', 1800.00, 2000.00, 200.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (35, 1, '2026-10-12 07:19:41.560149', 130.00, 150.00, 20.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (36, 1, '2026-10-12 07:24:06.333389', 4200.00, 5000.00, 800.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (37, 1, '2026-10-12 08:26:44.48748', 1304.00, 1500.00, 196.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (38, 1, '2026-10-12 08:27:57.384075', 1206.00, 1300.00, 94.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (39, 1, '2026-10-12 08:47:06.127113', 54.00, 100.00, 46.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (40, 1, '2026-10-12 08:49:22.366642', 4400.00, 5000.00, 600.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (41, 1, '2026-10-12 18:25:40.584862', 2750.00, 3000.00, 250.00, '');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (42, 1, '2026-10-12 18:26:24.720097', 126.00, 150.00, 24.00, '');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (43, 1, '2026-10-13 12:42:45.307733', 2750.00, 3000.00, 250.00, '');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (44, 1, '2026-10-13 07:58:08.523385', 78.00, 80.00, 2.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (45, 1, '2026-10-13 16:02:21.886642', 52.00, 60.00, 8.00, '');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (46, 1, '2026-10-13 16:03:25.617762', 66.00, 100.00, 34.00, '');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (47, 1, '2026-10-13 16:42:01.760574', 230.00, 250.00, 20.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (48, 1, '2026-10-14 11:06:35.545436', 1650.00, 1700.00, 50.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (49, 1, '2026-10-14 15:16:41.89182', 26.00, 30.00, 4.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (50, 1, '2026-10-15 03:40:33.215553', 32.00, 50.00, 18.00, NULL);
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (51, 1, '2026-10-15 05:17:16.196451', 4950.00, 5000.00, 50.00, '[web-mv8m1z95tbzd]');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (52, 1, '2026-10-15 05:17:39.722808', 26.00, 50.00, 24.00, '[web-mv8m2he9g1yf]');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (53, 1, '2026-10-15 05:25:41.025374', 26.00, 50.00, 24.00, '[web-mv8mcsrt2r9e]');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (54, 1, '2026-10-15 05:41:56.588297', 48.00, 50.00, 2.00, '[web-mv8mxojj7vf6]');
INSERT INTO public.orders OVERRIDING SYSTEM VALUE VALUES (55, 1, '2026-10-15 05:47:54.204707', 2804.00, 3000.00, 196.00, '[web-mv8n5d3ov3yd]');


--
-- TOC entry 3902 (class 0 OID 18517)
-- Dependencies: 391
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (4, 'Colgate Regular 150g', 'Personal Care', 66.50, 28.50, 95.00, 0, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (3, 'Safeguard White 130g', 'Personal Care', 33.60, 14.40, 48.00, 74, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (8, 'Century Tuna Oil 155g', 'Canned Goods', 26.60, 11.40, 38.00, 59, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (9, 'Pale Pilsen 330ml Can', 'Beverages', 45.50, 19.50, 65.00, 109, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (10, 'Poten-Cee Vitamin C', 'Medicine', 5.25, 2.25, 7.50, 85, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (5, 'Kopiko Black 3-in-1', 'Beverages', 5.60, 2.40, 8.00, 197, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (11, 'Lucky Me Pancit Canton 80g', 'Snacks', 10.50, 4.50, 15.00, 120, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (12, 'San Mig Light 330ml Can', 'Beverages', 49.00, 21.00, 70.00, 85, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (15, 'Palmolive Shampoo 12ml Sachet', 'Personal Care', 4.90, 2.10, 7.00, 180, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (16, 'SkyFlakes Crackers 250g', 'Snacks', 35.00, 15.00, 50.00, 45, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (18, 'Datu Puti Soy Sauce 385ml', 'Condiments', 16.80, 7.20, 24.00, 40, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (19, 'Nature Spring Water 500ml', 'Beverages', 10.50, 4.50, 15.00, 140, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (24, 'San Marino Corned Tuna 180g', 'Canned Goods', 31.50, 13.50, 45.00, 50, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (25, 'Medicol Advance 200mg', 'Medicine', 5.95, 2.55, 8.50, 95, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (26, 'Piattos Cheese 85g', 'Snacks', 26.60, 11.40, 38.00, 65, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (28, 'Datu Puti Vinegar 385ml', 'Condiments', 14.00, 6.00, 20.00, 55, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (30, 'Solmux 500mg Capsule', 'Medicine', 9.80, 4.20, 14.00, 80, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (31, 'Oishi Prawn Crackers 60g', 'Snacks', 12.60, 5.40, 18.00, 100, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (32, 'Downy Sunrise Fresh Sachet 28ml', 'Household', 5.60, 2.40, 8.00, 160, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (33, 'Selecta Fortified Milk 1L', 'Dairy', 64.40, 27.60, 92.00, 18, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (34, 'Red Horse Beer 330ml Can', 'Beverages', 47.60, 20.40, 68.00, 70, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (35, 'Tang Orange Juice Powder 20g', 'Beverages', 13.30, 5.70, 19.00, 130, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (1, 'Biogesic 500mg', 'Medicine', 3.85, 1.65, 5.50, 133, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (20, 'Bioflu Tablet', 'Medicine', 6.30, 2.70, 9.00, 108, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (36, 'Lucky Me Beef Na Beef Pancit Canton 55g', 'Snacks', 9.80, 4.20, 14.00, 140, '2027-03-15', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (40, 'Fita Biscuits 300g', 'Snacks', 30.80, 13.20, 44.00, 60, '2027-02-28', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (41, 'Mogu-Mogu Lychee 320ml', 'Beverages', 24.50, 10.50, 35.00, 75, '2027-05-12', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (44, 'Royal Tru-Orange 237ml', 'Beverages', 9.80, 4.20, 14.00, 150, '2027-03-01', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (45, 'Great Taste White 3-in-1 30g', 'Beverages', 6.30, 2.70, 9.00, 260, '2027-06-30', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (47, 'Gatorade Blue Bolt 500ml', 'Beverages', 29.40, 12.60, 42.00, 48, '2027-04-04', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (48, 'Tanduay Ice Citrus 330ml', 'Beverages', 40.60, 17.40, 58.00, 64, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (49, 'Vitamilk Soy Original 250ml', 'Dairy', 19.60, 8.40, 28.00, 55, '2026-12-20', 15);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (52, 'Eden Cheese 165g', 'Dairy', 43.40, 18.60, 62.00, 40, '2026-12-05', 15);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (53, 'Ligo Sardines Tomato Sauce 155g', 'Canned Goods', 16.80, 7.20, 24.00, 130, '2027-08-01', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (55, 'Purefoods Corned Beef 150g', 'Canned Goods', 32.20, 13.80, 46.00, 60, '2027-09-10', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (56, 'Dingdong Mixed Nuts 100g', 'Snacks', 22.40, 9.60, 32.00, 8, '2027-01-31', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (57, 'Silver Swan Soy Sauce 385ml', 'Condiments', 15.40, 6.60, 22.00, 50, '2027-07-07', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (59, 'Knorr Sinigang Mix 22g', 'Condiments', 9.10, 3.90, 13.00, 150, '2027-05-05', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (60, 'Maggi Magic Sarap 8g', 'Condiments', 4.20, 1.80, 6.00, 300, '2027-05-05', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (62, 'Tide Powder Bar 130g', 'Household', 12.60, 5.40, 18.00, 100, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (63, 'Joy Dishwashing Liquid 250ml', 'Household', 36.40, 15.60, 52.00, 45, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (65, 'Efficascent Oil 25ml', 'Medicine', 33.60, 14.40, 48.00, 40, '2028-01-01', 15);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (67, 'Diatabs Tablet', 'Medicine', 7.70, 3.30, 11.00, 5, '2027-09-09', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (68, 'Rexona Roll-On 25ml', 'Personal Care', 40.60, 17.40, 58.00, 38, '2027-11-11', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (69, 'Close-Up Red Hot 25g', 'Personal Care', 14.00, 6.00, 20.00, 90, '2027-12-01', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (27, 'Mang Tomas All-Purpose Sauce 325g', 'Condiments', 25.20, 10.80, 36.00, 15, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (21, 'Cream Silk Conditioner 180ml', 'Personal Care', 84.00, 36.00, 120.00, 5, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (38, 'Chippy BBQ 110g', 'Snacks', 15.40, 6.60, 22.00, 108, '2027-01-20', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (29, 'C2 Green Tea Apple 500ml', 'Beverages', 19.60, 8.40, 28.00, 89, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (51, 'Birch Tree Fortified Milk 33g', 'Dairy', 9.80, 4.20, 14.00, 107, '2027-03-22', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (7, 'Bear Brand Milk 320g', 'Dairy', 80.50, 34.50, 115.00, 2, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (22, 'Nescafe Classic 25g', 'Beverages', 15.40, 6.60, 22.00, 147, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (14, 'Alaxan FR 200mg', 'Medicine', 7.00, 3.00, 10.00, 85, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (58, 'UFC Banana Ketchup 320g', 'Condiments', 22.40, 9.60, 32.00, 44, '2027-06-18', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (64, 'Zonrox Bleach', 'Household', 20.00, 10.00, 30.00, 70, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (37, 'Nissin Cup Noodles Seafood 40g', 'Snacks', 17.50, 7.50, 25.00, 87, '2027-02-10', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (70, 'Pagasa Pandesal Bag 10pcs', 'Bakery', 24.50, 10.50, 35.00, 11, '2026-10-12', 10);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (17, 'Argentina Corned Beef 150g', 'Canned Goods', 29.40, 12.60, 42.00, 48, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (54, '555 Sardines Tomato Sauce 155g', 'Canned Goods', 18.20, 7.80, 26.00, 95, '2027-08-01', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (75, 'Polvoron', 'Snacks', 5.00, 0.00, 3.00, 100, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (6, 'Gardenia White Bread', 'Bakery', 52.50, 22.50, 75.00, 12, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (2, 'Neozep Forte', 'Medicine', 4.20, 1.80, 6.00, 5, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (39, 'Cloud 9 Classic Chocolate Bar 34g', 'Snacks', 10.50, 4.50, 15.00, 158, '2027-04-30', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (23, 'Surf Powder Detergent 80g', 'Household', 8.40, 3.60, 12.00, 198, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (42, 'Coca-Cola Sakto 200ml', 'Beverages', 8.40, 3.60, 12.00, 217, '2027-03-01', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (13, 'Milo Powder Drink 22g', 'Beverages', 7.00, 3.00, 10.00, 249, NULL, 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (43, 'Sprite Sakto 200ml', 'Beverages', 8.40, 3.60, 12.00, 196, '2027-03-01', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (50, 'Alaska Evaporada 370ml', 'Dairy', 33.60, 14.40, 48.00, 10, '2027-02-14', 20);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (74, '5kg Ganador Rice', 'Cook', 540.00, 10.00, 550.00, 195, NULL, 3);
INSERT INTO public.products OVERRIDING SYSTEM VALUE VALUES (61, 'Ajinomoto Vetsin 50g', 'Condiments', 12.60, 5.40, 18.00, 126, '2026-10-14', 20);


--
-- TOC entry 3908 (class 0 OID 18559)
-- Dependencies: 397
-- Data for Name: stock_adjustments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.stock_adjustments OVERRIDING SYSTEM VALUE VALUES (74, 61, 4, 'STOCK OUT', -3, 12.60, '2026-10-07 14:42:16.435638', NULL);
INSERT INTO public.stock_adjustments OVERRIDING SYSTEM VALUE VALUES (85, 61, 4, 'STOCK IN', 100, 12.60, '2026-10-07 16:36:12.450445', NULL);
INSERT INTO public.stock_adjustments OVERRIDING SYSTEM VALUE VALUES (87, 74, 4, 'STOCK IN', 10, 540.00, '2026-10-09 18:13:31.511549', 'Product added to inventory');
INSERT INTO public.stock_adjustments OVERRIDING SYSTEM VALUE VALUES (91, 74, 1, 'STOCK IN', 10, 540.00, '2026-10-12 05:41:33.598225', NULL);
INSERT INTO public.stock_adjustments OVERRIDING SYSTEM VALUE VALUES (93, 75, 1, 'STOCK IN', 100, 5.00, '2026-10-12 05:44:08.409753', 'Product added to inventory');
INSERT INTO public.stock_adjustments OVERRIDING SYSTEM VALUE VALUES (94, 54, 1, 'STOCK IN', 1, 18.20, '2026-10-12 06:59:57.854086', 'Ref: hmm.');
INSERT INTO public.stock_adjustments OVERRIDING SYSTEM VALUE VALUES (95, 54, 1, 'STOCK OUT', -1, 18.20, '2026-10-12 07:03:53.712906', 'Ref: hmmmm. fvbn');
INSERT INTO public.stock_adjustments OVERRIDING SYSTEM VALUE VALUES (96, 54, 1, 'STOCK IN', 10, 18.20, '2026-10-12 07:18:48.805148', NULL);
INSERT INTO public.stock_adjustments OVERRIDING SYSTEM VALUE VALUES (97, 54, 1, 'STOCK IN', 100, 18.20, '2026-10-12 08:47:34.097914', NULL);
INSERT INTO public.stock_adjustments OVERRIDING SYSTEM VALUE VALUES (98, 74, 1, 'STOCK IN', 300, 540.00, '2026-10-12 08:47:54.655501', NULL);
INSERT INTO public.stock_adjustments OVERRIDING SYSTEM VALUE VALUES (99, 61, 1, 'STOCK IN', 100, 12.60, '2026-10-13 19:01:55.097476', 'new stock');
INSERT INTO public.stock_adjustments OVERRIDING SYSTEM VALUE VALUES (100, 74, 1, 'STOCK OUT', -78, 540.00, '2026-10-13 19:02:48.05087', 'remove it is onli 28');


--
-- TOC entry 3898 (class 0 OID 18502)
-- Dependencies: 387
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users OVERRIDING SYSTEM VALUE VALUES (4, 'Resty Aldave', 'cid', '$2y$12$ARqU8.iOVuLSwHMy6T.JZ.bKrlFp760.rVey3rPO4NnIvZVJ5NfW.', 'Admin');
INSERT INTO public.users OVERRIDING SYSTEM VALUE VALUES (1, 'Alekos Owner', 'admin', '$2y$12$8sTsxaXAU6otoT47UasF2u.OoNdSe5Wzr/892a5I6nTrMkl7DBYBu', 'Admin');
INSERT INTO public.users OVERRIDING SYSTEM VALUE VALUES (2, 'Maria Santos', 'cashier1', '$2y$12$8sTsxaXAU6otoT47UasF2u.OoNdSe5Wzr/892a5I6nTrMkl7DBYBu', 'Staff');
INSERT INTO public.users OVERRIDING SYSTEM VALUE VALUES (3, 'Juan Dela Cruz', 'manager1', '$2y$12$8sTsxaXAU6otoT47UasF2u.OoNdSe5Wzr/892a5I6nTrMkl7DBYBu', 'Manager');


--
-- TOC entry 3933 (class 0 OID 0)
-- Dependencies: 388
-- Name: capital_configs_config_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.capital_configs_config_id_seq', 1, true);


--
-- TOC entry 3934 (class 0 OID 0)
-- Dependencies: 398
-- Name: histories_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.histories_history_id_seq', 55, true);


--
-- TOC entry 3935 (class 0 OID 0)
-- Dependencies: 394
-- Name: order_items_order_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.order_items_order_item_id_seq', 101, true);


--
-- TOC entry 3936 (class 0 OID 0)
-- Dependencies: 392
-- Name: orders_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.orders_order_id_seq', 55, true);


--
-- TOC entry 3937 (class 0 OID 0)
-- Dependencies: 390
-- Name: products_product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.products_product_id_seq', 75, true);


--
-- TOC entry 3938 (class 0 OID 0)
-- Dependencies: 396
-- Name: stock_adjustments_adjustment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.stock_adjustments_adjustment_id_seq', 100, true);


--
-- TOC entry 3939 (class 0 OID 0)
-- Dependencies: 386
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 4, true);


--
-- TOC entry 3722 (class 2606 OID 18515)
-- Name: capital_configs capital_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.capital_configs
    ADD CONSTRAINT capital_configs_pkey PRIMARY KEY (config_id);


--
-- TOC entry 3734 (class 2606 OID 18582)
-- Name: histories histories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.histories
    ADD CONSTRAINT histories_pkey PRIMARY KEY (history_id);


--
-- TOC entry 3728 (class 2606 OID 18547)
-- Name: order_items order_items_order_product_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_product_unique UNIQUE (order_id, product_id);


--
-- TOC entry 3730 (class 2606 OID 18545)
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (order_item_id);


--
-- TOC entry 3726 (class 2606 OID 18533)
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (order_id);


--
-- TOC entry 3724 (class 2606 OID 18523)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (product_id);


--
-- TOC entry 3732 (class 2606 OID 18564)
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (adjustment_id);


--
-- TOC entry 3718 (class 2606 OID 18506)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 3720 (class 2606 OID 18508)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 3740 (class 2606 OID 18583)
-- Name: histories histories_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.histories
    ADD CONSTRAINT histories_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 3736 (class 2606 OID 18548)
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE;


--
-- TOC entry 3737 (class 2606 OID 18553)
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- TOC entry 3735 (class 2606 OID 18534)
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE RESTRICT;


--
-- TOC entry 3738 (class 2606 OID 18565)
-- Name: stock_adjustments stock_adjustments_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- TOC entry 3739 (class 2606 OID 18570)
-- Name: stock_adjustments stock_adjustments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE RESTRICT;


--
-- TOC entry 3890 (class 0 OID 18510)
-- Dependencies: 389
-- Name: capital_configs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.capital_configs ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3895 (class 0 OID 18576)
-- Dependencies: 399
-- Name: histories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.histories ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3893 (class 0 OID 18540)
-- Dependencies: 395
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3892 (class 0 OID 18525)
-- Dependencies: 393
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3891 (class 0 OID 18517)
-- Dependencies: 391
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3894 (class 0 OID 18559)
-- Dependencies: 397
-- Name: stock_adjustments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3889 (class 0 OID 18502)
-- Dependencies: 387
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- TOC entry 3917 (class 0 OID 0)
-- Dependencies: 25
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO prd_service_account;


--
-- TOC entry 3918 (class 0 OID 0)
-- Dependencies: 412
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rls_auto_enable() TO anon;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;


--
-- TOC entry 3919 (class 0 OID 0)
-- Dependencies: 389
-- Name: TABLE capital_configs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.capital_configs TO anon;
GRANT ALL ON TABLE public.capital_configs TO authenticated;
GRANT ALL ON TABLE public.capital_configs TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.capital_configs TO prd_service_account;


--
-- TOC entry 3920 (class 0 OID 0)
-- Dependencies: 388
-- Name: SEQUENCE capital_configs_config_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.capital_configs_config_id_seq TO anon;
GRANT ALL ON SEQUENCE public.capital_configs_config_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.capital_configs_config_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.capital_configs_config_id_seq TO prd_service_account;


--
-- TOC entry 3921 (class 0 OID 0)
-- Dependencies: 399
-- Name: TABLE histories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.histories TO anon;
GRANT ALL ON TABLE public.histories TO authenticated;
GRANT ALL ON TABLE public.histories TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.histories TO prd_service_account;


--
-- TOC entry 3922 (class 0 OID 0)
-- Dependencies: 398
-- Name: SEQUENCE histories_history_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.histories_history_id_seq TO anon;
GRANT ALL ON SEQUENCE public.histories_history_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.histories_history_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.histories_history_id_seq TO prd_service_account;


--
-- TOC entry 3923 (class 0 OID 0)
-- Dependencies: 395
-- Name: TABLE order_items; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.order_items TO anon;
GRANT ALL ON TABLE public.order_items TO authenticated;
GRANT ALL ON TABLE public.order_items TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.order_items TO prd_service_account;


--
-- TOC entry 3924 (class 0 OID 0)
-- Dependencies: 394
-- Name: SEQUENCE order_items_order_item_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.order_items_order_item_id_seq TO anon;
GRANT ALL ON SEQUENCE public.order_items_order_item_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.order_items_order_item_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.order_items_order_item_id_seq TO prd_service_account;


--
-- TOC entry 3925 (class 0 OID 0)
-- Dependencies: 393
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.orders TO anon;
GRANT ALL ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.orders TO prd_service_account;


--
-- TOC entry 3926 (class 0 OID 0)
-- Dependencies: 392
-- Name: SEQUENCE orders_order_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.orders_order_id_seq TO anon;
GRANT ALL ON SEQUENCE public.orders_order_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.orders_order_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.orders_order_id_seq TO prd_service_account;


--
-- TOC entry 3927 (class 0 OID 0)
-- Dependencies: 391
-- Name: TABLE products; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.products TO anon;
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.products TO prd_service_account;


--
-- TOC entry 3928 (class 0 OID 0)
-- Dependencies: 390
-- Name: SEQUENCE products_product_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.products_product_id_seq TO anon;
GRANT ALL ON SEQUENCE public.products_product_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.products_product_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.products_product_id_seq TO prd_service_account;


--
-- TOC entry 3929 (class 0 OID 0)
-- Dependencies: 397
-- Name: TABLE stock_adjustments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stock_adjustments TO anon;
GRANT ALL ON TABLE public.stock_adjustments TO authenticated;
GRANT ALL ON TABLE public.stock_adjustments TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.stock_adjustments TO prd_service_account;


--
-- TOC entry 3930 (class 0 OID 0)
-- Dependencies: 396
-- Name: SEQUENCE stock_adjustments_adjustment_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.stock_adjustments_adjustment_id_seq TO anon;
GRANT ALL ON SEQUENCE public.stock_adjustments_adjustment_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.stock_adjustments_adjustment_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.stock_adjustments_adjustment_id_seq TO prd_service_account;


--
-- TOC entry 3931 (class 0 OID 0)
-- Dependencies: 387
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO prd_service_account;


--
-- TOC entry 3932 (class 0 OID 0)
-- Dependencies: 386
-- Name: SEQUENCE users_user_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.users_user_id_seq TO anon;
GRANT ALL ON SEQUENCE public.users_user_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.users_user_id_seq TO service_role;
GRANT SELECT,USAGE ON SEQUENCE public.users_user_id_seq TO prd_service_account;


--
-- TOC entry 2487 (class 826 OID 16494)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO prd_service_account;


--
-- TOC entry 2466 (class 826 OID 16495)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- TOC entry 2465 (class 826 OID 16493)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 2468 (class 826 OID 16497)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- TOC entry 2486 (class 826 OID 16492)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO prd_service_account;


--
-- TOC entry 2467 (class 826 OID 16496)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


-- Completed on 2026-10-15 06:50:42 PST

--
-- PostgreSQL database dump complete
--

\unrestrict oYIczkb4HDdKF3ejs8GdD2By88ZrRwss5TaUKmadl9U9ozEWyGwen3vKwXvWq0K

