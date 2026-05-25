-- =============================================
-- MERMA ALERT — Schema base de datos
-- =============================================

-- Tabla de negocios (multi-tenant)
CREATE TABLE IF NOT EXISTS negocios (
  id         SERIAL PRIMARY KEY,
  nombre     VARCHAR(100) NOT NULL,
  email      VARCHAR(100) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,        -- hash bcrypt
  whatsapp   VARCHAR(20),                  -- para alertas
  plan       VARCHAR(20) DEFAULT 'basico', -- basico | pro
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de productos (catálogo por negocio)
CREATE TABLE IF NOT EXISTS productos (
  id         SERIAL PRIMARY KEY,
  negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre     VARCHAR(150) NOT NULL,
  sku        VARCHAR(80),
  unidad     VARCHAR(30) DEFAULT 'pieza',  -- pieza, kg, litro, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de lotes (el corazón del sistema)
CREATE TABLE IF NOT EXISTS lotes (
  id               SERIAL PRIMARY KEY,
  negocio_id       INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  producto_id      INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad         NUMERIC(10, 2) NOT NULL,
  cantidad_inicial NUMERIC(10, 2) NOT NULL,
  fecha_caducidad  DATE NOT NULL,
  notas            TEXT,
  activo           BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para acelerar las consultas de alertas diarias
CREATE INDEX IF NOT EXISTS idx_lotes_negocio_fecha
  ON lotes(negocio_id, fecha_caducidad)
  WHERE activo = TRUE AND cantidad > 0;

-- Vista útil: lotes con nombre del producto y días para vencer
CREATE OR REPLACE VIEW vista_lotes AS
SELECT
  l.id,
  l.negocio_id,
  p.nombre        AS producto,
  p.sku,
  p.unidad,
  l.cantidad,
  l.cantidad_inicial,
  l.fecha_caducidad,
  l.notas,
  (l.fecha_caducidad - CURRENT_DATE) AS dias_para_vencer,
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
