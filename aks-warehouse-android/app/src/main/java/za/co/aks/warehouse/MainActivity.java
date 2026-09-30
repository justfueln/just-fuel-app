package za.co.aks.warehouse;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final String LIVE_URL = "https://ufolqntrfmvefpvrjnsa.supabase.co/functions/v1/aks-warehouse";
    private static final String ALLOWED_HOST = "ufolqntrfmvefpvrjnsa.supabase.co";

    private WebView webView;
    private LinearLayout errorView;
    private ProgressBar progress;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        enterImmersiveMode();

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);

        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        progress = new ProgressBar(this);
        FrameLayout.LayoutParams pp = new FrameLayout.LayoutParams(72, 72);
        pp.gravity = Gravity.CENTER;
        root.addView(progress, pp);

        errorView = buildErrorView();
        errorView.setVisibility(View.GONE);
        root.addView(errorView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);
        configureWebView();
        applyKioskIfManaged();
        loadWarehouse();
    }

    private LinearLayout buildErrorView() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(48, 48, 48, 48);
        box.setBackgroundColor(Color.WHITE);

        TextView title = new TextView(this);
        title.setText("AKS Warehouse Stock");
        title.setTextSize(24);
        title.setTextColor(Color.rgb(15, 23, 42));
        title.setGravity(Gravity.CENTER);

        TextView msg = new TextView(this);
        msg.setText("\nUnable to connect to the warehouse.\nCheck Wi-Fi / mobile data and try again.\n");
        msg.setTextSize(16);
        msg.setTextColor(Color.DKGRAY);
        msg.setGravity(Gravity.CENTER);

        Button retry = new Button(this);
        retry.setText("RETRY");
        retry.setOnClickListener(v -> loadWarehouse());

        box.addView(title);
        box.addView(msg);
        box.addView(retry);
        return box;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " AKSWarehouseScanner/1.0");
        s.setSafeBrowsingEnabled(true);

        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setLongClickable(false);
        webView.setOnLongClickListener(v -> true);
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> { });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture,
                                          android.os.Message resultMsg) {
                return false;
            }

            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progress.setVisibility(newProgress < 90 ? View.VISIBLE : View.GONE);
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                return !("https".equalsIgnoreCase(uri.getScheme())
                        && ALLOWED_HOST.equalsIgnoreCase(uri.getHost()));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                errorView.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError();
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                showError();
            }
        });
    }

    private void loadWarehouse() {
        errorView.setVisibility(View.GONE);
        progress.setVisibility(View.VISIBLE);
        webView.setVisibility(View.VISIBLE);
        webView.loadUrl(LIVE_URL);
    }

    private void showError() {
        progress.setVisibility(View.GONE);
        webView.setVisibility(View.GONE);
        errorView.setVisibility(View.VISIBLE);
    }

    private void enterImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    private void applyKioskIfManaged() {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(this, AKSDeviceAdminReceiver.class);
        if (dpm.isDeviceOwnerApp(getPackageName())) {
            try {
                dpm.setLockTaskPackages(admin, new String[]{getPackageName()});
                try { dpm.setApplicationHidden(admin, "com.android.chrome", true); } catch (Exception ignored) { }
                try { dpm.setStatusBarDisabled(admin, true); } catch (Exception ignored) { }
                try { dpm.setKeyguardDisabled(admin, true); } catch (Exception ignored) { }
                startLockTask();
            } catch (Exception ignored) { }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        enterImmersiveMode();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && !LIVE_URL.equals(webView.getUrl())) {
            webView.loadUrl(LIVE_URL);
        }
    }
}
