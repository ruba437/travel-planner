import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/planner_provider.dart';
import 'chat_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  // 這裡未來會用來存放從後端抓下來的行程列表
  List<dynamic> _itineraries = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _fetchItineraries();
  }

  // 模擬/準備串接抓取行程列表的 API
  Future<void> _fetchItineraries() async {
    setState(() => _isLoading = true);
    try {
      // TODO: 之後這裡要串接 GET /api/itineraries 取得使用者的行程列表
      // 目前先暫時留空，展示「還沒有行程」的畫面
      await Future.delayed(const Duration(milliseconds: 500)); // 模擬網路延遲
      _itineraries = []; 
    } catch (e) {
      debugPrint('抓取行程失敗: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // 透過 Provider 取得使用者資訊
    final auth = Provider.of<AuthProvider>(context);
    final userName = auth.user?['displayName'] ?? '旅人';

    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text('我的行程', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.redAccent),
            tooltip: '登出',
            onPressed: () => _showLogoutDialog(context, auth),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _itineraries.isEmpty
              ? _buildEmptyState(userName)
              : _buildItineraryList(),
      
      // 修改 HomeScreen 的浮動按鈕點擊事件
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          // 🆕 點擊時清空舊對話，並跳轉到 ChatScreen
          Provider.of<PlannerProvider>(context, listen: false).clearChat();
          Navigator.of(context).push(
            MaterialPageRoute(builder: (context) => const ChatScreen()),
          );
        },
        backgroundColor: const Color(0xFF0F766E),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_location_alt),
        label: const Text('規劃新行程', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }

  // 畫面：當沒有任何行程時顯示的「空狀態」
  Widget _buildEmptyState(String userName) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.explore_outlined, size: 80, color: Colors.teal[100]),
          const SizedBox(height: 16),
          Text(
            '哈囉，$userName\n您目前還沒有建立任何行程喔',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 18, color: Colors.black54, height: 1.5),
          ),
          const SizedBox(height: 8),
          const Text(
            '點擊右下角讓 AI 幫你規劃一趟完美旅程吧！',
            style: TextStyle(fontSize: 14, color: Colors.grey),
          ),
        ],
      ),
    );
  }

  // 畫面：當有行程時顯示的列表 (目前為備用架構)
  Widget _buildItineraryList() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _itineraries.length,
      itemBuilder: (context, index) {
        final trip = _itineraries[index];
        return Card(
          elevation: 2,
          margin: const EdgeInsets.only(bottom: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: ListTile(
            contentPadding: const EdgeInsets.all(16),
            leading: const CircleAvatar(
              backgroundColor: Color(0xFFccfbf1),
              child: Icon(Icons.flight_takeoff, color: Color(0xFF0F766E)),
            ),
            title: Text(trip['title'] ?? '未命名行程', style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('${trip['days']} 天行程 • ${trip['city']}'),
            trailing: const Icon(Icons.arrow_forward_ios, size: 16, color: Colors.grey),
            onTap: () {
              // TODO: 點擊後進入行程詳情頁面
            },
          ),
        );
      },
    );
  }

  // 登出確認對話框
  void _showLogoutDialog(BuildContext context, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('登出確認'),
        content: const Text('確定要登出您的帳號嗎？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('取消', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              auth.logout(); // 呼叫 AuthProvider 的登出
            },
            child: const Text('登出', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}