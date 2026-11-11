# Commons Compress instantiates ZIP extra fields by reflection during initialization.
-keep,allowobfuscation class * implements org.apache.commons.compress.archivers.zip.ZipExtraField {
    public <init>();
}
