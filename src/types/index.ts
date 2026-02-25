export type Method =
    | 'get' | 'GET'
    | 'post' | 'POST'
    | 'put' | 'PUT'
    | 'patch' | 'PATCH'
    | 'delete' | 'DELETE'
    | 'head' | 'HEAD'
    | 'options' | 'OPTIONS';

export type ParamValue = string | number | boolean | null | undefined;

export type Params = Record<string, ParamValue | ParamValue[]>;

export type HeadersInit = Record<string, string> | Headers | [string, string][];

export type ParamsSerializer = (params: Params) => string;

export interface RetryConfig {
    retries: number;
    delay: number;
    backoff: number;
    retryOn: string[];
    retryStatusCodes: number[];
    retryCondition?: (error: unknown) => boolean;
}

export interface FetchGoProgressEvent {
    loaded: number;
    total?: number;
    progress?: number;
    bytes: number;
    estimated?: number;
    rate?: number;
    upload?: boolean;
    download?: boolean;
}

export type Adapter = 'fetch' | 'http' | ((config: FetchGoRequestConfig) => Promise<FetchGoResponse>);

export interface FetchGoRequestConfig<D = unknown> {
    baseURL?: string;
    url?: string;
    method?: Method;
    headers?: HeadersInit;
    params?: Params;
    paramsSerializer?: ParamsSerializer;
    data?: D;
    timeout?: number;
    signal?: AbortSignal;
    responseType?: 'json' | 'text' | 'blob' | 'arraybuffer' | 'formdata' | 'stream';
    withCredentials?: boolean;
    retry?: Partial<RetryConfig> | number | boolean;
    validateStatus?: (status: number) => boolean;
    transformRequest?: ((data: unknown, headers: Record<string, string>) => unknown)[];
    transformResponse?: ((data: unknown) => unknown)[];
    mode?: RequestMode;
    cache?: RequestCache;
    redirect?: RequestRedirect;
    referrerPolicy?: ReferrerPolicy;
    integrity?: string;
    keepalive?: boolean;
    fetchOptions?: RequestInit;
    xsrfCookieName?: string;
    xsrfHeaderName?: string;
    formSerializer?: 'formdata' | 'urlencoded';
    maxRedirects?: number;
    onUploadProgress?: (progressEvent: FetchGoProgressEvent) => void;
    onDownloadProgress?: (progressEvent: FetchGoProgressEvent) => void;
    maxContentLength?: number;
    maxBodyLength?: number;
    adapter?: Adapter;
}

export interface FetchGoResponse<T = unknown> {
    data: T;
    status: number;
    statusText: string;
    headers: Headers;
    config: FetchGoRequestConfig;
    request: Response;
}

export interface InterceptorHandlers<V> {
    fulfilled: (value: V) => V | Promise<V>;
    rejected?: (error: unknown) => unknown;
}

export interface InterceptorManagerInterface<V> {
    use(
        onFulfilled: (value: V) => V | Promise<V>,
        onRejected?: (error: unknown) => unknown
    ): number;
    eject(id: number): void;
    clear(): void;
    forEach(fn: (handler: InterceptorHandlers<V>) => void): void;
}

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
