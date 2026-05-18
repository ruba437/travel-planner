import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
// import 'screens/home_screen.dart'; // 稍後我們會實作首頁

void main() {
  runApp(
    MultiProvider(
      providers: [
        // 註冊 AuthProvider，這樣全 APP 都可以拿到 user 跟 token
        ChangeNotifierProvider(create: (_) => AuthProvider()),
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
      // Consumer 會監聽 AuthProvider 的變化，當登入狀態改變時自動切換畫面
      home: Consumer<AuthProvider>(
        builder: (context, auth, child) {
          if (auth.isLoading) {
            // 還在等 shared_preferences 讀取 Token 時，顯示載入中
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }

          if (auth.isAuthenticated) {
            // 已經登入了！(我們暫時先用一個簡單的畫面代替 HomeScreen)
            return Scaffold(
              appBar: AppBar(title: const Text('我的行程')),
              body: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text('歡迎, ${auth.user?['displayName']}! 🚀'),
                    ElevatedButton(
                      onPressed: () => auth.logout(),
                      child: const Text('登出'),
                    )
                  ],
                ),
              ),
            );
          }

          // 沒有登入，顯示登入畫面
          return const LoginScreen();
        },
      ),
    );
  }
}