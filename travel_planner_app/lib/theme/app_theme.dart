import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  static const Color orange = Color(0xFFFF6934);
  static const Color orangeStrong = Color(0xFFF1561F);
  static const Color teal = Color(0xFF0CBFB0);
  static const Color bg = Color(0xFFF5F5F7);
  static const Color surface = Colors.white;
  static const Color border = Color(0xFFE8E8EC);
  static const Color text = Color(0xFF1A1A2E);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color textMuted = Color(0xFF9CA3AF);
}

ThemeData buildTravelPlannerTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: const ColorScheme.light(
      primary: AppColors.orange,
      onPrimary: Colors.white,
      secondary: AppColors.teal,
      onSecondary: Colors.white,
      surface: AppColors.surface,
      onSurface: AppColors.text,
      error: Color(0xFFDC2626),
      onError: Colors.white,
      outline: AppColors.border,
    ),
  );

  final textTheme = GoogleFonts.dmSansTextTheme(base.textTheme).copyWith(
    displayLarge: GoogleFonts.cormorantGaramond(
      textStyle: base.textTheme.displayLarge?.copyWith(
        color: AppColors.text,
        fontWeight: FontWeight.w700,
        letterSpacing: -1,
      ),
    ),
    displayMedium: GoogleFonts.cormorantGaramond(
      textStyle: base.textTheme.displayMedium?.copyWith(
        color: AppColors.text,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.6,
      ),
    ),
    headlineLarge: GoogleFonts.cormorantGaramond(
      textStyle: base.textTheme.headlineLarge?.copyWith(
        color: AppColors.text,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.5,
      ),
    ),
    titleLarge: base.textTheme.titleLarge?.copyWith(
      color: AppColors.text,
      fontWeight: FontWeight.w700,
    ),
    titleMedium: base.textTheme.titleMedium?.copyWith(
      color: AppColors.text,
      fontWeight: FontWeight.w600,
    ),
    bodyLarge: base.textTheme.bodyLarge?.copyWith(color: AppColors.text),
    bodyMedium: base.textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary),
    labelLarge: base.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
  );

  final roundedBorder = OutlineInputBorder(
    borderRadius: BorderRadius.circular(10),
    borderSide: const BorderSide(color: AppColors.border),
  );

  return base.copyWith(
    scaffoldBackgroundColor: AppColors.bg,
    textTheme: textTheme,
    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.surface,
      surfaceTintColor: AppColors.surface,
      elevation: 1,
      shadowColor: Colors.black12,
      foregroundColor: AppColors.text,
      centerTitle: false,
      titleTextStyle: textTheme.titleLarge?.copyWith(fontSize: 18),
    ),
    cardTheme: CardThemeData(
      color: AppColors.surface,
      surfaceTintColor: AppColors.surface,
      elevation: 2,
      shadowColor: Colors.black12,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      margin: EdgeInsets.zero,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      border: roundedBorder,
      enabledBorder: roundedBorder,
      focusedBorder: roundedBorder.copyWith(
        borderSide: const BorderSide(color: AppColors.teal, width: 1.4),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      labelStyle: const TextStyle(color: AppColors.textSecondary),
      hintStyle: const TextStyle(color: AppColors.textMuted),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.orange,
        foregroundColor: Colors.white,
        elevation: 0,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.orange,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.orange,
        side: const BorderSide(color: AppColors.orange),
        minimumSize: const Size.fromHeight(44),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: AppColors.teal),
    ),
    chipTheme: base.chipTheme.copyWith(
      backgroundColor: const Color(0xFFF0FDF9),
      selectedColor: const Color(0xFFE2FCF8),
      side: const BorderSide(color: AppColors.border),
      labelStyle: const TextStyle(color: AppColors.text),
      secondaryLabelStyle: const TextStyle(color: AppColors.orange),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: AppColors.surface,
      selectedItemColor: AppColors.orange,
      unselectedItemColor: AppColors.textMuted,
      type: BottomNavigationBarType.fixed,
      elevation: 10,
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: AppColors.orange,
      foregroundColor: Colors.white,
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: AppColors.orange),
    dividerTheme: const DividerThemeData(color: AppColors.border, thickness: 1),
  );
}