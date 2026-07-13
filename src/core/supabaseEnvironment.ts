export type AppEnvironment = 'development' | 'production';

export type SupabaseEnvironmentConfig = {
  appEnv: AppEnvironment | null;
  expectedProjectRef: string | null;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
};

export type SupabaseEnvironmentValidation = {
  isConfigured: boolean;
  appEnv: AppEnvironment | null;
  expectedProjectRef: string | null;
  actualProjectRef: string | null;
  isValid: boolean;
  errorMessage: string | null;
  shouldShowDevBanner: boolean;
  shouldBlockApp: boolean;
};

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;

export function parseAppEnvironment(value: unknown): AppEnvironment | null {
  if (value === 'development' || value === 'production') {
    return value;
  }
  return null;
}

export function extractProjectRefFromSupabaseUrl(url: string): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    const ref = hostname.split('.')[0] ?? '';
    return PROJECT_REF_PATTERN.test(ref) ? ref : null;
  } catch {
    return null;
  }
}

/**
 * クライアントが必要とする VITE_ 変数だけを個別に読む。
 *
 * `import.meta.env` をそのまま参照すると、Vite が全 VITE_ 変数（他機能の秘匿値を
 * 含む）をオブジェクトごとバンドルへインライン展開してしまう。必要なキーだけを
 * 明示参照することで、意図しない秘匿値の混入を防ぐ（例: 過去の Anthropic キー混入）。
 */
function readClientViteEnv(): Record<string, string | boolean | undefined> {
  return {
    VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
    VITE_EXPECTED_SUPABASE_REF: import.meta.env.VITE_EXPECTED_SUPABASE_REF,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

export function readSupabaseEnvironmentConfig(
  env: Record<string, string | boolean | undefined> = readClientViteEnv(),
): SupabaseEnvironmentConfig {
  const supabaseUrl = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL : null;
  const supabaseAnonKey =
    typeof env.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY : null;
  const expectedProjectRef =
    typeof env.VITE_EXPECTED_SUPABASE_REF === 'string' && env.VITE_EXPECTED_SUPABASE_REF.length > 0
      ? env.VITE_EXPECTED_SUPABASE_REF
      : null;

  return {
    appEnv: parseAppEnvironment(env.VITE_APP_ENV),
    expectedProjectRef,
    supabaseUrl,
    supabaseAnonKey,
  };
}

export function isSupabaseClientConfigured(config: SupabaseEnvironmentConfig): boolean {
  return (
    typeof config.supabaseUrl === 'string' &&
    config.supabaseUrl.startsWith('https://') &&
    typeof config.supabaseAnonKey === 'string' &&
    config.supabaseAnonKey.length > 0
  );
}

export function validateSupabaseEnvironment(
  config: SupabaseEnvironmentConfig,
): SupabaseEnvironmentValidation {
  const isConfigured = isSupabaseClientConfigured(config);

  if (!isConfigured) {
    return {
      isConfigured: false,
      appEnv: config.appEnv,
      expectedProjectRef: config.expectedProjectRef,
      actualProjectRef: null,
      isValid: true,
      errorMessage: null,
      shouldShowDevBanner: false,
      shouldBlockApp: false,
    };
  }

  const actualProjectRef = extractProjectRefFromSupabaseUrl(config.supabaseUrl ?? '');
  const expectedProjectRef = config.expectedProjectRef;

  if (!actualProjectRef) {
    return {
      isConfigured: true,
      appEnv: config.appEnv,
      expectedProjectRef,
      actualProjectRef: null,
      isValid: false,
      errorMessage: 'VITE_SUPABASE_URL から Project ref を取得できません。',
      shouldShowDevBanner: false,
      shouldBlockApp: true,
    };
  }

  if (!expectedProjectRef) {
    return {
      isConfigured: true,
      appEnv: config.appEnv,
      expectedProjectRef: null,
      actualProjectRef,
      isValid: false,
      errorMessage: 'VITE_EXPECTED_SUPABASE_REF が未設定です。',
      shouldShowDevBanner: false,
      shouldBlockApp: true,
    };
  }

  if (expectedProjectRef !== actualProjectRef) {
    return {
      isConfigured: true,
      appEnv: config.appEnv,
      expectedProjectRef,
      actualProjectRef,
      isValid: false,
      errorMessage: `Supabase Project ref の不一致: expected=${expectedProjectRef}, actual=${actualProjectRef}`,
      shouldShowDevBanner: false,
      shouldBlockApp: true,
    };
  }

  const shouldShowDevBanner = config.appEnv === 'development';

  return {
    isConfigured: true,
    appEnv: config.appEnv,
    expectedProjectRef,
    actualProjectRef,
    isValid: true,
    errorMessage: null,
    shouldShowDevBanner,
    shouldBlockApp: false,
  };
}

export function getProjectRefSuffix(projectRef: string | null, length = 4): string | null {
  if (!projectRef || projectRef.length < length) return null;
  return projectRef.slice(-length);
}
