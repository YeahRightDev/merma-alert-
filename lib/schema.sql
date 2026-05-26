-- =============================================
-- MERMA ALERT — Schema v2 (con dinero)
-- =============================================

CREATE TABLE IF NOT EXISTS negocios (
  id         SERIAL PRIMARY KEY,
  nombre     VARCHAR(100) NOT NULL,
  email      VARCHAR(100) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,
  whatsapp   VARCHAR(20),
  plan       VARCHAR(20) DEFAULT 'basico',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS productos (
  id           SERIAL PRIMARY KEY,
  negocio_id   INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre       VARCHAR(150) NOT NULL,
  sku          VARCHAR(80),
  unidad       VARCHAR(30) DEFAULT 'pieza',
  marca        VARCHAR(100),
  categoria    VARCHAR(100),
  imagen_url   TEXT,
  precio_venta DECIMAL(10,2) DEFAULT 0,
  costo_compra DECIMAL(10,2) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_productos_sku ON productos(sku) WHERE sku IS NOT NULL;

CREATE TABLE IF NOT EXISTS lotes (
  id               SERIAL PRIMARY KEY,
  negocio_id       INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  producto_id      INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad         NUMERIC(10,2) NOT NULL,
  cantidad_inicial NUMERIC(10,2) NOT NULL,
  fecha_caducidad  DATE NOT NULL,
  notas            TEXT,
  activo           BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lotes_negocio_fecha
  ON lotes(negocio_id, fecha_caducidad)
  WHERE activo = TRUE AND cantidad > 0;

CREATE TABLE IF NOT EXISTS historico_dinero_salvado (
  id             SERIAL PRIMARY KEY,
  negocio_id     INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  producto_id    INTEGER REFERENCES productos(id),
  lote_id        INTEGER REFERENCES lotes(id),
  monto_salvado  DECIMAL(10,2) NOT NULL,
  cantidad       NUMERIC(10,2) DEFAULT 1,
  fecha_registro TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE VIEW vista_lotes AS
SELECT
  l.id,
  l.negocio_id,
  p.nombre        AS producto,
  p.marca,
  p.sku,
  p.unidad,
  p.imagen_url,
  p.precio_venta,
  p.costo_compra,
  l.cantidad,
  l.cantidad_inicial,
  l.fecha_caducidad,
  l.notas,
  (l.fecha_caducidad - CURRENT_DATE)            AS dias_para_vencer,
  (l.cantidad * p.costo_compra)                 AS dinero_en_riesgo,
  CASE
    WHEN (l.fecha_caducidad - CURRENT_DATE) <= 7  THEN 'rojo'
    WHEN (l.fecha_caducidad - CURRENT_DATE) <= 30 THEN 'amarillo'
    ELSE 'verde'
  END AS semaforo,
  l.activo,
  l.created_at
FROM lotes l
JOIN productos p ON p.id = l.producto_id
WHERE l.activo = TRUE AND l.cantidad > 0
ORDER BY l.fecha_caducidad ASC;
