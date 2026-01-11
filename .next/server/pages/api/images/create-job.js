"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "pages/api/images/create-job";
exports.ids = ["pages/api/images/create-job"];
exports.modules = {

/***/ "(api-node)/./lib/firebaseAdmin.js":
/*!******************************!*\
  !*** ./lib/firebaseAdmin.js ***!
  \******************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   adminAuth: () => (/* binding */ adminAuth),\n/* harmony export */   adminDb: () => (/* binding */ adminDb)\n/* harmony export */ });\n/* harmony import */ var firebase_admin__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! firebase-admin */ \"firebase-admin\");\n/* harmony import */ var firebase_admin__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(firebase_admin__WEBPACK_IMPORTED_MODULE_0__);\n\nif (!(firebase_admin__WEBPACK_IMPORTED_MODULE_0___default().apps).length) {\n    firebase_admin__WEBPACK_IMPORTED_MODULE_0___default().initializeApp({\n        projectId: process.env.FIREBASE_PROJECT_ID\n    });\n}\nconst adminDb = firebase_admin__WEBPACK_IMPORTED_MODULE_0___default().firestore();\nconst adminAuth = firebase_admin__WEBPACK_IMPORTED_MODULE_0___default().auth();\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGFwaS1ub2RlKS8uL2xpYi9maXJlYmFzZUFkbWluLmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBbUM7QUFFbkMsSUFBSSxDQUFDQSw0REFBVSxDQUFDRSxNQUFNLEVBQUU7SUFDdEJGLG1FQUFtQixDQUFDO1FBQ2xCSSxXQUFXQyxRQUFRQyxHQUFHLENBQUNDLG1CQUFtQjtJQUM1QztBQUNGO0FBRU8sTUFBTUMsVUFBVVIsK0RBQWUsR0FBRztBQUNsQyxNQUFNVSxZQUFZViwwREFBVSxHQUFHIiwic291cmNlcyI6WyJDOlxcREVWXFwwMDAwMl9BVVJFQSBERVNJR04gU1RVRElPXFxhdXJlYS1kZXNpZ24tc3R1ZGlvXFxhdXJlYS1kZXNpZ24tc3R1ZGlvXFxsaWJcXGZpcmViYXNlQWRtaW4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGFkbWluIGZyb20gXCJmaXJlYmFzZS1hZG1pblwiO1xyXG5cclxuaWYgKCFhZG1pbi5hcHBzLmxlbmd0aCkge1xyXG4gIGFkbWluLmluaXRpYWxpemVBcHAoe1xyXG4gICAgcHJvamVjdElkOiBwcm9jZXNzLmVudi5GSVJFQkFTRV9QUk9KRUNUX0lELFxyXG4gIH0pO1xyXG59XHJcblxyXG5leHBvcnQgY29uc3QgYWRtaW5EYiA9IGFkbWluLmZpcmVzdG9yZSgpO1xyXG5leHBvcnQgY29uc3QgYWRtaW5BdXRoID0gYWRtaW4uYXV0aCgpO1xyXG4iXSwibmFtZXMiOlsiYWRtaW4iLCJhcHBzIiwibGVuZ3RoIiwiaW5pdGlhbGl6ZUFwcCIsInByb2plY3RJZCIsInByb2Nlc3MiLCJlbnYiLCJGSVJFQkFTRV9QUk9KRUNUX0lEIiwiYWRtaW5EYiIsImZpcmVzdG9yZSIsImFkbWluQXV0aCIsImF1dGgiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(api-node)/./lib/firebaseAdmin.js\n");

/***/ }),

/***/ "(api-node)/./node_modules/next/dist/build/webpack/loaders/next-route-loader/index.js?kind=PAGES_API&page=%2Fapi%2Fimages%2Fcreate-job&preferredRegion=&absolutePagePath=.%2Fpages%5Capi%5Cimages%5Ccreate-job.js&middlewareConfigBase64=e30%3D!":
/*!********************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-route-loader/index.js?kind=PAGES_API&page=%2Fapi%2Fimages%2Fcreate-job&preferredRegion=&absolutePagePath=.%2Fpages%5Capi%5Cimages%5Ccreate-job.js&middlewareConfigBase64=e30%3D! ***!
  \********************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   config: () => (/* binding */ config),\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__),\n/* harmony export */   routeModule: () => (/* binding */ routeModule)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_route_modules_pages_api_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/route-modules/pages-api/module.compiled */ \"(api-node)/./node_modules/next/dist/server/route-modules/pages-api/module.compiled.js\");\n/* harmony import */ var next_dist_server_route_modules_pages_api_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_route_modules_pages_api_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/route-kind */ \"(api-node)/./node_modules/next/dist/server/route-kind.js\");\n/* harmony import */ var next_dist_build_templates_helpers__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/build/templates/helpers */ \"(api-node)/./node_modules/next/dist/build/templates/helpers.js\");\n/* harmony import */ var _pages_api_images_create_job_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./pages\\api\\images\\create-job.js */ \"(api-node)/./pages/api/images/create-job.js\");\n\n\n\n// Import the userland code.\n\n// Re-export the handler (should be the default export).\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,next_dist_build_templates_helpers__WEBPACK_IMPORTED_MODULE_2__.hoist)(_pages_api_images_create_job_js__WEBPACK_IMPORTED_MODULE_3__, 'default'));\n// Re-export config.\nconst config = (0,next_dist_build_templates_helpers__WEBPACK_IMPORTED_MODULE_2__.hoist)(_pages_api_images_create_job_js__WEBPACK_IMPORTED_MODULE_3__, 'config');\n// Create and export the route module that will be consumed.\nconst routeModule = new next_dist_server_route_modules_pages_api_module_compiled__WEBPACK_IMPORTED_MODULE_0__.PagesAPIRouteModule({\n    definition: {\n        kind: next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.PAGES_API,\n        page: \"/api/images/create-job\",\n        pathname: \"/api/images/create-job\",\n        // The following aren't used in production.\n        bundlePath: '',\n        filename: ''\n    },\n    userland: _pages_api_images_create_job_js__WEBPACK_IMPORTED_MODULE_3__\n});\n\n//# sourceMappingURL=pages-api.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGFwaS1ub2RlKS8uL25vZGVfbW9kdWxlcy9uZXh0L2Rpc3QvYnVpbGQvd2VicGFjay9sb2FkZXJzL25leHQtcm91dGUtbG9hZGVyL2luZGV4LmpzP2tpbmQ9UEFHRVNfQVBJJnBhZ2U9JTJGYXBpJTJGaW1hZ2VzJTJGY3JlYXRlLWpvYiZwcmVmZXJyZWRSZWdpb249JmFic29sdXRlUGFnZVBhdGg9LiUyRnBhZ2VzJTVDYXBpJTVDaW1hZ2VzJTVDY3JlYXRlLWpvYi5qcyZtaWRkbGV3YXJlQ29uZmlnQmFzZTY0PWUzMCUzRCEiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFBK0Y7QUFDdkM7QUFDRTtBQUMxRDtBQUNnRTtBQUNoRTtBQUNBLGlFQUFlLHdFQUFLLENBQUMsNERBQVEsWUFBWSxFQUFDO0FBQzFDO0FBQ08sZUFBZSx3RUFBSyxDQUFDLDREQUFRO0FBQ3BDO0FBQ08sd0JBQXdCLHlHQUFtQjtBQUNsRDtBQUNBLGNBQWMsa0VBQVM7QUFDdkI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTCxZQUFZO0FBQ1osQ0FBQzs7QUFFRCIsInNvdXJjZXMiOlsiIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFBhZ2VzQVBJUm91dGVNb2R1bGUgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9yb3V0ZS1tb2R1bGVzL3BhZ2VzLWFwaS9tb2R1bGUuY29tcGlsZWRcIjtcbmltcG9ydCB7IFJvdXRlS2luZCB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL3JvdXRlLWtpbmRcIjtcbmltcG9ydCB7IGhvaXN0IH0gZnJvbSBcIm5leHQvZGlzdC9idWlsZC90ZW1wbGF0ZXMvaGVscGVyc1wiO1xuLy8gSW1wb3J0IHRoZSB1c2VybGFuZCBjb2RlLlxuaW1wb3J0ICogYXMgdXNlcmxhbmQgZnJvbSBcIi4vcGFnZXNcXFxcYXBpXFxcXGltYWdlc1xcXFxjcmVhdGUtam9iLmpzXCI7XG4vLyBSZS1leHBvcnQgdGhlIGhhbmRsZXIgKHNob3VsZCBiZSB0aGUgZGVmYXVsdCBleHBvcnQpLlxuZXhwb3J0IGRlZmF1bHQgaG9pc3QodXNlcmxhbmQsICdkZWZhdWx0Jyk7XG4vLyBSZS1leHBvcnQgY29uZmlnLlxuZXhwb3J0IGNvbnN0IGNvbmZpZyA9IGhvaXN0KHVzZXJsYW5kLCAnY29uZmlnJyk7XG4vLyBDcmVhdGUgYW5kIGV4cG9ydCB0aGUgcm91dGUgbW9kdWxlIHRoYXQgd2lsbCBiZSBjb25zdW1lZC5cbmV4cG9ydCBjb25zdCByb3V0ZU1vZHVsZSA9IG5ldyBQYWdlc0FQSVJvdXRlTW9kdWxlKHtcbiAgICBkZWZpbml0aW9uOiB7XG4gICAgICAgIGtpbmQ6IFJvdXRlS2luZC5QQUdFU19BUEksXG4gICAgICAgIHBhZ2U6IFwiL2FwaS9pbWFnZXMvY3JlYXRlLWpvYlwiLFxuICAgICAgICBwYXRobmFtZTogXCIvYXBpL2ltYWdlcy9jcmVhdGUtam9iXCIsXG4gICAgICAgIC8vIFRoZSBmb2xsb3dpbmcgYXJlbid0IHVzZWQgaW4gcHJvZHVjdGlvbi5cbiAgICAgICAgYnVuZGxlUGF0aDogJycsXG4gICAgICAgIGZpbGVuYW1lOiAnJ1xuICAgIH0sXG4gICAgdXNlcmxhbmRcbn0pO1xuXG4vLyMgc291cmNlTWFwcGluZ1VSTD1wYWdlcy1hcGkuanMubWFwIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(api-node)/./node_modules/next/dist/build/webpack/loaders/next-route-loader/index.js?kind=PAGES_API&page=%2Fapi%2Fimages%2Fcreate-job&preferredRegion=&absolutePagePath=.%2Fpages%5Capi%5Cimages%5Ccreate-job.js&middlewareConfigBase64=e30%3D!\n");

/***/ }),

/***/ "(api-node)/./pages/api/images/create-job.js":
/*!****************************************!*\
  !*** ./pages/api/images/create-job.js ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ handler)\n/* harmony export */ });\n/* harmony import */ var _lib_firebaseAdmin__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../../lib/firebaseAdmin */ \"(api-node)/./lib/firebaseAdmin.js\");\n\nasync function handler(req, res) {\n    try {\n        if (req.method !== \"POST\") {\n            return res.status(405).json({\n                error: \"Method not allowed\"\n            });\n        }\n        const { prompt, size = \"1024x1024\" } = req.body || {};\n        if (!prompt || !prompt.trim()) {\n            return res.status(400).json({\n                error: \"Prompt requerido\"\n            });\n        }\n        const ref = await _lib_firebaseAdmin__WEBPACK_IMPORTED_MODULE_0__.adminDb.collection(\"imageJobs\").add({\n            prompt,\n            size,\n            status: \"queued\",\n            userId: \"dev\",\n            createdAt: new Date(),\n            updatedAt: new Date()\n        });\n        return res.status(200).json({\n            jobId: ref.id\n        });\n    } catch (err) {\n        console.error(\"CREATE JOB ERROR:\", err);\n        return res.status(500).json({\n            error: err.message\n        });\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGFwaS1ub2RlKS8uL3BhZ2VzL2FwaS9pbWFnZXMvY3JlYXRlLWpvYi5qcyIsIm1hcHBpbmdzIjoiOzs7OztBQUFxRDtBQUV0QyxlQUFlQyxRQUFRQyxHQUFHLEVBQUVDLEdBQUc7SUFDNUMsSUFBSTtRQUNGLElBQUlELElBQUlFLE1BQU0sS0FBSyxRQUFRO1lBQ3pCLE9BQU9ELElBQUlFLE1BQU0sQ0FBQyxLQUFLQyxJQUFJLENBQUM7Z0JBQUVDLE9BQU87WUFBcUI7UUFDNUQ7UUFFQSxNQUFNLEVBQUVDLE1BQU0sRUFBRUMsT0FBTyxXQUFXLEVBQUUsR0FBR1AsSUFBSVEsSUFBSSxJQUFJLENBQUM7UUFFcEQsSUFBSSxDQUFDRixVQUFVLENBQUNBLE9BQU9HLElBQUksSUFBSTtZQUM3QixPQUFPUixJQUFJRSxNQUFNLENBQUMsS0FBS0MsSUFBSSxDQUFDO2dCQUFFQyxPQUFPO1lBQW1CO1FBQzFEO1FBRUEsTUFBTUssTUFBTSxNQUFNWix1REFBT0EsQ0FBQ2EsVUFBVSxDQUFDLGFBQWFDLEdBQUcsQ0FBQztZQUNwRE47WUFDQUM7WUFDQUosUUFBUTtZQUNSVSxRQUFRO1lBQ1JDLFdBQVcsSUFBSUM7WUFDZkMsV0FBVyxJQUFJRDtRQUNqQjtRQUVBLE9BQU9kLElBQUlFLE1BQU0sQ0FBQyxLQUFLQyxJQUFJLENBQUM7WUFBRWEsT0FBT1AsSUFBSVEsRUFBRTtRQUFDO0lBQzlDLEVBQUUsT0FBT0MsS0FBSztRQUNaQyxRQUFRZixLQUFLLENBQUMscUJBQXFCYztRQUNuQyxPQUFPbEIsSUFBSUUsTUFBTSxDQUFDLEtBQUtDLElBQUksQ0FBQztZQUFFQyxPQUFPYyxJQUFJRSxPQUFPO1FBQUM7SUFDbkQ7QUFDRiIsInNvdXJjZXMiOlsiQzpcXERFVlxcMDAwMDJfQVVSRUEgREVTSUdOIFNUVURJT1xcYXVyZWEtZGVzaWduLXN0dWRpb1xcYXVyZWEtZGVzaWduLXN0dWRpb1xccGFnZXNcXGFwaVxcaW1hZ2VzXFxjcmVhdGUtam9iLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGFkbWluRGIgfSBmcm9tIFwiLi4vLi4vLi4vbGliL2ZpcmViYXNlQWRtaW5cIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGFzeW5jIGZ1bmN0aW9uIGhhbmRsZXIocmVxLCByZXMpIHtcclxuICB0cnkge1xyXG4gICAgaWYgKHJlcS5tZXRob2QgIT09IFwiUE9TVFwiKSB7XHJcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNSkuanNvbih7IGVycm9yOiBcIk1ldGhvZCBub3QgYWxsb3dlZFwiIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHsgcHJvbXB0LCBzaXplID0gXCIxMDI0eDEwMjRcIiB9ID0gcmVxLmJvZHkgfHwge307XHJcblxyXG4gICAgaWYgKCFwcm9tcHQgfHwgIXByb21wdC50cmltKCkpIHtcclxuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwiUHJvbXB0IHJlcXVlcmlkb1wiIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHJlZiA9IGF3YWl0IGFkbWluRGIuY29sbGVjdGlvbihcImltYWdlSm9ic1wiKS5hZGQoe1xyXG4gICAgICBwcm9tcHQsXHJcbiAgICAgIHNpemUsXHJcbiAgICAgIHN0YXR1czogXCJxdWV1ZWRcIixcclxuICAgICAgdXNlcklkOiBcImRldlwiLFxyXG4gICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCksXHJcbiAgICAgIHVwZGF0ZWRBdDogbmV3IERhdGUoKSxcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiByZXMuc3RhdHVzKDIwMCkuanNvbih7IGpvYklkOiByZWYuaWQgfSk7XHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICBjb25zb2xlLmVycm9yKFwiQ1JFQVRFIEpPQiBFUlJPUjpcIiwgZXJyKTtcclxuICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBlcnIubWVzc2FnZSB9KTtcclxuICB9XHJcbn1cclxuIl0sIm5hbWVzIjpbImFkbWluRGIiLCJoYW5kbGVyIiwicmVxIiwicmVzIiwibWV0aG9kIiwic3RhdHVzIiwianNvbiIsImVycm9yIiwicHJvbXB0Iiwic2l6ZSIsImJvZHkiLCJ0cmltIiwicmVmIiwiY29sbGVjdGlvbiIsImFkZCIsInVzZXJJZCIsImNyZWF0ZWRBdCIsIkRhdGUiLCJ1cGRhdGVkQXQiLCJqb2JJZCIsImlkIiwiZXJyIiwiY29uc29sZSIsIm1lc3NhZ2UiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(api-node)/./pages/api/images/create-job.js\n");

/***/ }),

/***/ "firebase-admin":
/*!*********************************!*\
  !*** external "firebase-admin" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("firebase-admin");

/***/ }),

/***/ "next/dist/compiled/next-server/pages-api.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/pages-api.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/pages-api.runtime.dev.js");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-api-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next"], () => (__webpack_exec__("(api-node)/./node_modules/next/dist/build/webpack/loaders/next-route-loader/index.js?kind=PAGES_API&page=%2Fapi%2Fimages%2Fcreate-job&preferredRegion=&absolutePagePath=.%2Fpages%5Capi%5Cimages%5Ccreate-job.js&middlewareConfigBase64=e30%3D!")));
module.exports = __webpack_exports__;

})();