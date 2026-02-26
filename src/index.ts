
import { FetchGo } from './core/FetchGo.js';

export { FetchGo } from './core/FetchGo.js';
export { FetchGoError, isFetchGoError, isCancel, ERR_CANCELED, ERR_NETWORK, ERR_TIMEOUT, ERR_BAD_REQUEST, ERR_BAD_RESPONSE } from './error/FetchGoError.js';
export { InterceptorManager } from './core/InterceptorManager.js';
export { buildURL } from './helpers/buildURL.js';
export { httpAdapter } from './adapters/http.js';
export { toFormData, formToJSON } from './helpers/utils.js';
export { createThrottledStream } from './helpers/throttle.js';

export type {
    Method,
    Params,
    ParamsSerializer,
    FetchGoRequestConfig,
    FetchGoResponse,
    FetchGoProgressEvent,
    RetryConfig,
    Adapter,
    AuthConfig,
    ProxyConfig,
    FetchGoInstance,
    InterceptorHandlers,
    InterceptorManagerInterface,
    InterceptorOptions,
    FormSerializerOptions,
    TransitionalOptions,
    EnvConfig,
    MethodHeaders,
    MethodHeadersKey,
} from './types/index.js';

const fetchgo = new FetchGo({
    headers: {
        'Accept': 'application/json, text/plain, */*',
    },
    timeout: 0,
    validateStatus: (status: number) => status >= 200 && status < 300,
    transitional: {
        silentJSONParsing: true,
        forcedJSONParsing: false,
        clarifyTimeoutError: true,
    },
});

export default fetchgo;

export { fetchgo };

