import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:travel_planner_app/providers/planner_provider.dart';

import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart'; // 🆕 1. 取消註解，引入剛寫好的 HomeScreen

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => PlannerProvider()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Travel Planner',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F766E)),
        useMaterial3: true,
      ),
      home: Consumer<AuthProvider>(
        builder: (context, auth, child) {
          if (auth.isLoading) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }

          if (auth.isAuthenticated) {
            // 🆕 2. 登入成功後，直接回傳 HomeScreen！
            return const HomeScreen();
          }

          return const LoginScreen();
        },
      ),
    );
  }
}