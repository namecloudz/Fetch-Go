
import { FetchGo } from './core/FetchGo.js';

export { FetchGo } from './core/FetchGo.js';
export { FetchGoError, isFetchGoError, isCancel, ERR_CANCELED, ERR_NETWORK, ERR_TIMEOUT, ERR_BAD_REQUEST, ERR_BAD_RESPONSE } from './error/FetchGoError.js';
export { InterceptorManager } from './core/InterceptorManager.js';
export { buildURL } from './helpers/buildURL.js';
export { httpAdapter } from './adapters/http.js';

export type {
    Method,
    Params,
    ParamsSerializer,
    FetchGoRequestConfig,
    FetchGoResponse,
    FetchGoProgressEvent,
    RetryConfig,
    Adapter,
    FetchGoInstance,
    InterceptorHandlers,
    InterceptorManagerInterface,
} from './types/index.js';

const fetchgo = new FetchGo({
    headers: {
        'Accept': 'application/json, text/plain, */*',
    },
    timeout: 0,
    validateStatus: (status: number) => status >= 200 && status < 300,
});

export default fetchgo;

export { fetchgo };
