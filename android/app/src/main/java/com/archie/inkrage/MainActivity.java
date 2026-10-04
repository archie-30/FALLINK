package com.archie.inkrage;

import android.os.Bundle;
import android.view.WindowManager;

import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private OnBackPressedCallback backCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemBars();

        // Back button / back gesture: hand it to the game (same as pressing Esc).
        // If the game says it has nothing to close (idle main menu), let the system handle it.
        backCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() == null || getBridge().getWebView() == null) {
                    fallBack();
                    return;
                }
                getBridge().getWebView().evaluateJavascript(
                    "(function(){try{return window.__inkrageBack?window.__inkrageBack():false;}catch(e){return false;}})()",
                    value -> {
                        if (!"true".equals(value)) {
                            fallBack();
                        }
                    });
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backCallback);
    }

    private void fallBack() {
        backCallback.setEnabled(false);
        getOnBackPressedDispatcher().onBackPressed();
    }

    @Override
    public void onResume() {
        super.onResume();
        // the system may keep the activity alive after "back"; make sure our handler is active again
        if (backCallback != null) {
            backCallback.setEnabled(true);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat c =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }
}
