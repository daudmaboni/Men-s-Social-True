package tz.kayani.menssocial.sleep;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * "SleepTracking" for the web app (Step 57): Google Play services' Sleep API.
 * The phone's motion and light sensors are read by Google, not by us; we get sleep segments and store them
 * on the phone. The web app reads them each morning and turns them into nights labelled "Detected by your phone".
 */
@CapacitorPlugin(
    name = "SleepTracking",
    permissions = { @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION }) }
)
public class SleepPlugin extends Plugin {

    private boolean permissionGranted() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true;
        return getPermissionState("activity") == PermissionState.GRANTED;
    }

    /** { available, permission: "granted" | "denied" | "prompt", enabled } */
    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", SleepRegistrar.playServicesAvailable(getContext()));
        String perm = "granted";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            PermissionState s = getPermissionState("activity");
            perm = s == PermissionState.GRANTED ? "granted" : s == PermissionState.DENIED ? "denied" : "prompt";
        }
        r.put("permission", perm);
        r.put("enabled", SleepStore.isEnabled(getContext()));
        call.resolve(r);
    }

    /** Turn detection on (asks for "Physical activity" first if needed). Also used to re-register on each open. */
    @PluginMethod
    public void start(PluginCall call) {
        if (!SleepRegistrar.playServicesAvailable(getContext())) {
            call.reject("Google Play services is not available on this phone", "UNAVAILABLE");
            return;
        }
        if (!permissionGranted()) {
            requestPermissionForAlias("activity", call, "afterPermission");
            return;
        }
        register(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        if (permissionGranted()) register(call);
        else call.reject("Physical activity permission was not allowed", "DENIED");
    }

    private void register(PluginCall call) {
        try {
            SleepRegistrar.register(getContext())
                .addOnSuccessListener(v -> {
                    SleepStore.setEnabled(getContext(), true);
                    JSObject r = new JSObject();
                    r.put("enabled", true);
                    call.resolve(r);
                })
                .addOnFailureListener(e -> call.reject("Could not start sleep detection: " + e.getMessage(), "FAILED"));
        } catch (Exception e) {
            call.reject("Could not start sleep detection: " + e.getMessage(), "FAILED");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        SleepStore.setEnabled(getContext(), false);
        try {
            SleepRegistrar.unregister(getContext());
        } catch (Exception ignored) {
        }
        if (Boolean.TRUE.equals(call.getBoolean("forget", false))) SleepStore.clear(getContext());
        JSObject r = new JSObject();
        r.put("enabled", false);
        call.resolve(r);
    }

    /** { segments: [{ start, end, status, confidence }] } — times in ms; status 0 = detected; confidence 0–100 or -1 */
    @PluginMethod
    public void getSegments(PluginCall call) {
        long since = call.getLong("since", 0L);
        JSArray arr = new JSArray();
        org.json.JSONArray segs = SleepStore.segmentsSince(getContext(), since);
        for (int i = 0; i < segs.length(); i++) {
            try {
                arr.put(segs.getJSONObject(i));
            } catch (Exception ignored) {
            }
        }
        JSObject r = new JSObject();
        r.put("segments", arr);
        call.resolve(r);
    }

    /** Open this app's settings page (to allow "Physical activity" after saying no). */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }
}
