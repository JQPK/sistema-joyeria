INSERT INTO categorias (nombre) VALUES 
('Anillos'), ('Collares'), ('Aretes'), ('Pulseras'), ('Relojes'), ('Billeteras')
ON CONFLICT DO NOTHING;

INSERT INTO materiales (nombre) VALUES 
('Oro 18k'), ('Plata 925'), ('Oro Rosado'), ('Platino'), ('Acero Inoxidable')
ON CONFLICT DO NOTHING;

INSERT INTO config_empresa (id) VALUES (1)
ON CONFLICT DO NOTHING;
