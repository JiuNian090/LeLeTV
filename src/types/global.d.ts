/**
 * LeLeTV 全局类型声明
 */

interface Window {
  __ENV__: {
    PASSWORD?: string;
    ADMINPASSWORD?: string;
    TMDB_WORKER_URL?: string;
  };
  __LELETV_VERSION__?: string;
  LeLeTV: any;
  _jsSha256: any;
  sha256: any;
}
