// ============================================================
// Fetch-Go: Type Definitions
// ============================================================

/** Supported HTTP methods */
export type Method =
    | 'get' | 'GET'
    | 'post' | 'POST'
    | 'put' | 'PUT'
    | 'patch' | 'PATCH'
    | 'delete' | 'DELETE'
    | 'head' | 'HEAD'
    | 'options' | 'OPTIONS';

/** Query parameter values */
export type ParamValue = string | number | boolean | null | undefined;

/** Query parameters object */
export type Params = Record<string, ParamValue | ParamValue[]>;

/** Headers can be a plain object, Headers instance, or array of tuples */
export type HeadersInit = Record<string, string> | Headers | [string, string][];

/** Custom params serializer function */
export type ParamsSerializer = (params: Params) => string;

/** Retry configuration */
export interface RetryConfig {
    /** Number of retry attempts (default: 0) */
    retries: number;
    /** Base delay in ms between retries (default: 300) */
    delay: number;
    /** Multiplier for exponential backoff (default: 2) */
    backoff: number;
    /** HTTP methods to retry (default: ['GET','HEAD','OPTIONS','PUT','DELETE']) */
    retryOn: string[];
    /** HTTP status codes to retry on (default: [408, 429, 500, 502, 503, 504]) */
    retryStatusCodes: number[];
    /** Custom retry condition */
    retryCondition?: (error: unknown) => boolean;
}

/** Request configuration */
export interface FetchGoRequestConfig<D = unknown> {
    /** Base URL to prepend to `url` */
    baseURL?: string;
    /** Request URL (relative or absolute) */
    url?: string;
    /** HTTP method */
    method?: Method;
    /** Request headers */
    headers?: HeadersInit;
    /** URL query parameters */
    params?: Params;
    /** Custom params serializer */
    paramsSerializer?: ParamsSerializer;
    /** Request body (auto-serialized if object) */
    data?: D;
    /** Timeout in milliseconds (0 = no timeout) */
    timeout?: number;
    /** AbortSignal for cancellation */
    signal?: AbortSignal;
    /** Response type hint */
    responseType?: 'json' | 'text' | 'blob' | 'arraybuffer' | 'formdata';
    /** Include credentials (maps to fetch `credentials`) */
    withCredentials?: boolean;
    /** Retry configuration */
    retry?: Partial<RetryConfig> | number | boolean;
    /** Validate status code (return true to resolve, false to reject) */
    validateStatus?: (status: number) => boolean;
    /** Transform request data before sending */
    transformRequest?: ((data: unknown, headers: Record<string, string>) => unknown)[];
    /** Transform response data after receiving */
    transformResponse?: ((data: unknown) => unknown)[];
    /** Fetch API `mode` option */
    mode?: RequestMode;
    /** Fetch API `cache` option */
    cache?: RequestCache;
    /** Fetch API `redirect` option */
    redirect?: RequestRedirect;
    /** Fetch API `referrerPolicy` option */
    referrerPolicy?: ReferrerPolicy;
    /** Fetch API `integrity` option */
    integrity?: string;
    /** Fetch API `keepalive` option */
    keepalive?: boolean;
    /** Additional fetch init options (escape hatch) */
    fetchOptions?: RequestInit;
}

/** Response object */
export interface FetchGoResponse<T = unknown> {
    /** Parsed response data */
    data: T;
    /** HTTP status code */
    status: number;
    /** HTTP status text */
    statusText: string;
    /** Response headers */
    headers: Headers;
    /** The config that was used for the request */
    config: FetchGoRequestConfig;
    /** Raw Response object from fetch */
    request: Response;
}

/** Interceptor handlers */
export interface InterceptorHandlers<V> {
    fulfilled: (value: V) => V | Promise<V>;
    rejected?: (error: unknown) => unknown;
}

/** Interceptor manager interface */
export interface InterceptorManagerInterface<V> {
    use(
        onFulfilled: (value: V) => V | Promise<V>,
        onRejected?: (error: unknown) => unknown
    ): number;
    eject(id: number): void;
    clear(): void;
    forEach(fn: (handler: InterceptorHandlers<V>) => void): void;
}

/** FetchGo instance interface */
export interface FetchGoInstance {
    <T = unknown>(config: FetchGoRequestConfig): Promise<FetchGoResponse<T>>;
    <T = unknown>(url: string, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>>;

    defaults: FetchGoRequestConfig;
    interceptors: {
        request: InterceptorManagerInterface<FetchGoRequestConfig>;
        response: InterceptorManagerInterface<FetchGoResponse>;
    };

    request<T = unknown>(config: FetchGoRequestConfig): Promise<FetchGoResponse<T>>;
    get<T = unknown>(url: string, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>>;
    delete<T = unknown>(url: string, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>>;
    head<T = unknown>(url: string, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>>;
    options<T = unknown>(url: string, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>>;
    post<T = unknown>(url: string, data?: unknown, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>>;
    put<T = unknown>(url: string, data?: unknown, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>>;
    patch<T = unknown>(url: string, data?: unknown, config?: FetchGoRequestConfig): Promise<FetchGoResponse<T>>;

    create(config?: FetchGoRequestConfig): FetchGoInstance;
    isCancel(error: unknown): boolean;
}
