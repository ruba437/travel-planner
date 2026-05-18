import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/planner_provider.dart';
import 'itinerary_screen.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _textController = TextEditingController();
  final _scrollController = ScrollController();

  // 讓聊天室自動捲動到最底部的輔助函式
  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final planner = Provider.of<PlannerProvider>(context);

    // 每次對話列表有更新，自動捲動到最下面
    _scrollToBottom();

    return Scaffold(
      appBar: AppBar(
        title: const Text('AI 旅遊規劃助理'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 1,
        actions: [
          if (planner.currentPlan != null)
            Padding(
              padding: const EdgeInsets.only(right: 8.0),
              child: TextButton.icon(
                icon: const Icon(Icons.calendar_month, color: Color(0xFF0F766E)),
                label: const Text('查看行程', style: TextStyle(color: Color(0xFF0F766E), fontWeight: FontWeight.bold)),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (context) => const ItineraryScreen()),
                  );
                },
              ),
            ),
        ],
      ),
      body: Column(
        children: [
          // 1. 訊息對話列表區
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: planner.messages.length + (planner.currentProposals != null ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == planner.messages.length) {
                  return _buildProposalCards(planner, auth.token ?? '');
                }

                final msg = planner.messages[index];
                final isUser = msg['role'] == 'user';
                return _buildChatBubble(isUser, msg['content'] ?? '');
              },
            ),
          ),

          // 如果 AI 正在思考中，顯示一個小小的載入提示
          if (planner.isSending)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8.0),
              child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
            ),

          // 2. 底部輸入框區
          _buildInputArea(planner, auth.token ?? ''),
        ],
      ),
    );
  }

  // 輔助畫面：對話氣泡
  Widget _buildChatBubble(bool isUser, String content) {
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isUser ? const Color(0xFF0F766E) : Colors.grey[200],
          borderRadius: BorderRadius.circular(16).copyWith(
            bottomRight: isUser ? const Radius.circular(0) : const Radius.circular(16),
            topLeft: isUser ? const Radius.circular(16) : const Radius.circular(0),
          ),
        ),
        child: Text(
          content,
          style: TextStyle(
            color: isUser ? Colors.white : Colors.black87,
            fontSize: 16,
          ),
        ),
      ),
    );
  }

  // 輔助畫面：輸入框
  Widget _buildInputArea(PlannerProvider planner, String token) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.black12)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _textController,
              decoration: const InputDecoration(
                hintText: '輸入目的地、天數（如：東京玩5天）...',
                border: InputBorder.none,
              ),
              onSubmitted: (text) {
                if (!planner.isSending) {
                  final msg = _textController.text;
                  _textController.clear();
                  planner.handleSend(msg, token);
                }
              },
            ),
          ),
          IconButton(
            icon: const Icon(Icons.send, color: Color(0xFF0F766E)),
            onPressed: planner.isSending
                ? null
                : () {
                    final msg = _textController.text;
                    _textController.clear();
                    planner.handleSend(msg, token);
                  },
          ),
        ],
      ),
    );
  }

  // 🆕 輔助畫面：渲染橫向滑動的 3 個城市提案卡片
  Widget _buildProposalCards(PlannerProvider planner, String token) {
    final proposals = planner.currentProposals ?? [];
    
    return Container(
      height: 220,
      margin: const EdgeInsets.symmetric(vertical: 16),
      child: ListView.builder(
        scrollDirection: Axis.horizontal, // 橫向滑動！
        itemCount: proposals.length,
        itemBuilder: (context, idx) {
          final p = proposals[idx];
          
          return Container(
            width: 260,
            margin: const EdgeInsets.only(right: 16),
            child: Card(
              elevation: 4,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              color: Colors.white,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p['title'] ?? '精選提案',
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F766E)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Expanded(
                      child: Text(
                        p['description'] ?? '',
                        style: const TextStyle(fontSize: 14, color: Colors.black54),
                        maxLines: 4,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0F766E),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onPressed: planner.isSending 
                            ? null 
                            : () => planner.expandPlanDetail(p, token), // 點擊觸發詳細規劃！
                        child: const Text('選擇此方案', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}