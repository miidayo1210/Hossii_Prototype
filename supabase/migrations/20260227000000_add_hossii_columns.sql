-- F02/F04: 吹き出し座標固定・移動
ALTER TABLE hossiis ADD COLUMN IF NOT EXISTS position_x float DEFAULT NULL;
ALTER TABLE hossiis ADD COLUMN IF NOT EXISTS position_y float DEFAULT NULL;
ALTER TABLE hossiis ADD COLUMN IF NOT EXISTS is_position_fixed boolean DEFAULT false;

-- F05: 吹き出しリサイズ
ALTER TABLE hossiis ADD COLUMN IF NOT EXISTS scale float DEFAULT 1.0;

-- F06: 吹き出し非表示（管理者）
ALTER TABLE hossiis ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

-- F01: 吹き出し色選択
ALTER TABLE hossiis ADD COLUMN IF NOT EXISTS bubble_color varchar(7) DEFAULT NULL;

-- F09: ハッシュタグ付与
ALTER TABLE hossiis ADD COLUMN IF NOT EXISTS hashtags text[] DEFAULT '{}';

-- F10: 画像投稿
ALTER TABLE hossiis ADD COLUMN IF NOT EXISTS image_url text DEFAULT NULL;
