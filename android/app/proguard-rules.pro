# R8 rules for INKRAGE (Capacitor 8, no third-party plugins).
# Capacitor's own consumer rules (plugins, @PluginMethod, Cordova) are applied automatically.

-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,JavascriptInterface
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class com.getcapacitor.MessageHandler { *; }
-keep class com.getcapacitor.Bridge { public *; }
-keep class com.getcapacitor.BridgeActivity { public protected *; }
-keep class com.archie.inkrage.MainActivity { *; }

-dontwarn io.ionic.sslpinning.**
