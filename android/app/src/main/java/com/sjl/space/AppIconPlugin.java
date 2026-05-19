package com.sjl.space;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {

    private static final String[] ALIASES = {"Default", "Blue", "Purple"};

    @PluginMethod
    public void changeIcon(PluginCall call) {
        String iconName = call.getString("iconName", "default");
        String aliasSuffix = capitalize(iconName);
        String packageName = getContext().getPackageName();
        PackageManager pm = getContext().getPackageManager();

        for (String alias : ALIASES) {
            ComponentName cn = new ComponentName(packageName, packageName + ".MainActivity" + alias);
            int state = alias.equals(aliasSuffix)
                    ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
            pm.setComponentEnabledSetting(cn, state, PackageManager.DONT_KILL_APP);
        }

        call.resolve();
    }

    @PluginMethod
    public void getCurrentIcon(PluginCall call) {
        String packageName = getContext().getPackageName();
        PackageManager pm = getContext().getPackageManager();

        for (String alias : ALIASES) {
            try {
                ComponentName cn = new ComponentName(packageName, packageName + ".MainActivity" + alias);
                int state = pm.getComponentEnabledSetting(cn);
                if (state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                    JSObject res = new JSObject();
                    res.put("iconName", alias.toLowerCase());
                    call.resolve(res);
                    return;
                }
            } catch (IllegalArgumentException ignored) {
            }
        }

        JSObject res = new JSObject();
        res.put("iconName", "default");
        call.resolve(res);
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return "Default";
        return s.substring(0, 1).toUpperCase() + s.substring(1).toLowerCase();
    }
}
