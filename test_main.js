import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=3dadbd40"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import __vite__cjsImport1_react from "/node_modules/.vite/deps/react.js?v=3dadbd40"; const StrictMode = __vite__cjsImport1_react["StrictMode"];
import __vite__cjsImport2_reactDom_client from "/node_modules/.vite/deps/react-dom_client.js?v=3dadbd40"; const createRoot = __vite__cjsImport2_reactDom_client["createRoot"];
import App from "/src/App.tsx";
import "/src/index.css";
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      console.log("PWA ServiceWorker registered successfully with scope: ", registration.scope);
    }).catch((error) => {
      console.error("PWA ServiceWorker registration failed: ", error);
    });
  });
}
createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ jsxDEV(StrictMode, { children: /* @__PURE__ */ jsxDEV(App, {}, void 0, false, {
    fileName: "/app/applet/src/main.tsx",
    lineNumber: 21,
    columnNumber: 5
  }, this) }, void 0, false, {
    fileName: "/app/applet/src/main.tsx",
    lineNumber: 20,
    columnNumber: 3
  }, this)
);

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4udHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7U3RyaWN0TW9kZX0gZnJvbSAncmVhY3QnO1xuaW1wb3J0IHtjcmVhdGVSb290fSBmcm9tICdyZWFjdC1kb20vY2xpZW50JztcbmltcG9ydCBBcHAgZnJvbSAnLi9BcHAudHN4JztcbmltcG9ydCAnLi9pbmRleC5jc3MnO1xuXG4vLyBSZWdpc3RlciB0aGUgUFdBIHNlcnZpY2Ugd29ya2VyIGZvciBvZmZsaW5lLXNoZWxsIGNhY2hpbmcgYW5kIGluc3RhbGwgcHJvbXB0IHN1cHBvcnRcbmlmICgnc2VydmljZVdvcmtlcicgaW4gbmF2aWdhdG9yKSB7XG4gIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgKCkgPT4ge1xuICAgIG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLnJlZ2lzdGVyKCcvc3cuanMnKVxuICAgICAgLnRoZW4oKHJlZ2lzdHJhdGlvbikgPT4ge1xuICAgICAgICBjb25zb2xlLmxvZygnUFdBIFNlcnZpY2VXb3JrZXIgcmVnaXN0ZXJlZCBzdWNjZXNzZnVsbHkgd2l0aCBzY29wZTogJywgcmVnaXN0cmF0aW9uLnNjb3BlKTtcbiAgICAgIH0pXG4gICAgICAuY2F0Y2goKGVycm9yKSA9PiB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1BXQSBTZXJ2aWNlV29ya2VyIHJlZ2lzdHJhdGlvbiBmYWlsZWQ6ICcsIGVycm9yKTtcbiAgICAgIH0pO1xuICB9KTtcbn1cblxuY3JlYXRlUm9vdChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncm9vdCcpISkucmVuZGVyKFxuICA8U3RyaWN0TW9kZT5cbiAgICA8QXBwIC8+XG4gIDwvU3RyaWN0TW9kZT4sXG4pO1xuIl0sIm1hcHBpbmdzIjoiQUFvQkk7QUFwQkosU0FBUSxrQkFBaUI7QUFDekIsU0FBUSxrQkFBaUI7QUFDekIsT0FBTyxTQUFTO0FBQ2hCLE9BQU87QUFHUCxJQUFJLG1CQUFtQixXQUFXO0FBQ2hDLFNBQU8saUJBQWlCLFFBQVEsTUFBTTtBQUNwQyxjQUFVLGNBQWMsU0FBUyxRQUFRLEVBQ3RDLEtBQUssQ0FBQyxpQkFBaUI7QUFDdEIsY0FBUSxJQUFJLDBEQUEwRCxhQUFhLEtBQUs7QUFBQSxJQUMxRixDQUFDLEVBQ0EsTUFBTSxDQUFDLFVBQVU7QUFDaEIsY0FBUSxNQUFNLDJDQUEyQyxLQUFLO0FBQUEsSUFDaEUsQ0FBQztBQUFBLEVBQ0wsQ0FBQztBQUNIO0FBRUEsV0FBVyxTQUFTLGVBQWUsTUFBTSxDQUFFLEVBQUU7QUFBQSxFQUMzQyx1QkFBQyxjQUNDLGlDQUFDLFNBQUQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQUFLLEtBRFA7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQUVBO0FBQ0Y7IiwibmFtZXMiOltdfQ==