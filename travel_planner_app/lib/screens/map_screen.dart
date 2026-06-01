import 'dart:math';
import 'dart:ui' as ui;
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../theme/app_theme.dart';

class MapScreen extends StatefulWidget {
  final dynamic plan; 
  
  const MapScreen({super.key, required this.plan});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  GoogleMapController? _mapController;
  Set<Marker> _markers = {};
  Set<Polyline> _polylines = {}; 
  
  // 🆕 1. 將預設選中天數改為 1 (第一天)
  int? _selectedDay = 1; 
  // 🆕 2. 準備一個變數，用來記住地圖一開始該降落在哪裡
  LatLng? _initialTarget; 

  final List<Color> _lineColors = [
    AppColors.teal,
    AppColors.orange,
    AppColors.orangeStrong,
    Colors.purple,
    Colors.cyan,
    Colors.pink,
    AppColors.text,
  ];

  @override
  void initState() {
    super.initState();
    _findFirstDayStartLocation(); // 初始化時先找第一天起點
    _updateMapData();
  }

  // 🤖 尋找第一天起點，避免地圖一開始閃過台北101
  void _findFirstDayStartLocation() {
    try {
      final days = widget.plan['days'] ?? [];
      if (days.isNotEmpty) {
        final firstDayItems = days[0]['items'] ?? [];
        if (firstDayItems.isNotEmpty) {
          final lat = firstDayItems[0]['lat'];
          final lng = firstDayItems[0]['lng'];
          if (lat != null && lng != null) {
            _initialTarget = LatLng(
              double.parse(lat.toString()), 
              double.parse(lng.toString())
            );
            return;
          }
        }
      }
    } catch (e) {
      debugPrint('尋找起點失敗: $e');
    }
    // 防呆預設值
    _initialTarget = const LatLng(25.0330, 121.5654); 
  }

  // 🤖 繪圖函數：產生圖釘圖片
  Future<BitmapDescriptor> _createCustomMarkerBitmap(String text, Color color) async {
    // 🆕 3. 縮小圖釘尺寸：從 120 縮小到 75，讓畫面更乾淨
    const int size = 30; 
    final ui.PictureRecorder pictureRecorder = ui.PictureRecorder();
    final Canvas canvas = Canvas(pictureRecorder);

    final Paint paint = Paint()..color = color;
    final double radius = size / 2.0;
    canvas.drawCircle(Offset(radius, radius), radius, paint);

    // 微調白色邊框厚度，配合縮小後的圖標
    final Paint borderPaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 4.5 
      ..style = PaintingStyle.stroke;
    canvas.drawCircle(Offset(radius, radius), radius - 2.5, borderPaint);

    TextPainter painter = TextPainter(textDirection: TextDirection.ltr);
    painter.text = TextSpan(
      text: text,
      style: const TextStyle(
        fontSize: size / 2.2, 
        color: Colors.white, 
        fontWeight: FontWeight.bold,
      ),
    );
    painter.layout();
    
    painter.paint(
      canvas,
      Offset((size - painter.width) / 2, (size - painter.height) / 2),
    );

    final ui.Image image = await pictureRecorder.endRecording().toImage(size, size);
    final ByteData? byteData = await image.toByteData(format: ui.ImageByteFormat.png);
    final Uint8List uint8List = byteData!.buffer.asUint8List();

    return BitmapDescriptor.fromBytes(uint8List);
  }

  Future<void> _updateMapData() async {
    final days = widget.plan['days'] ?? [];
    int markerIdCounter = 0;
    
    final Set<Marker> newMarkers = {};
    final Set<Polyline> newPolylines = {};
    
    double minLat = 90.0;
    double maxLat = -90.0;
    double minLng = 180.0;
    double maxLng = -180.0;
    bool hasValidCoords = false;

    for (var day in days) {
      final int dayNum = day['day'] ?? 1;
      
      if (_selectedDay != null && dayNum != _selectedDay) continue;

      final items = day['items'] ?? [];
      final int colorIndex = (dayNum - 1) % _lineColors.length;
      final Color dayColor = _lineColors[colorIndex];
      
      List<LatLng> currentDayRoute = [];

      for (int i = 0; i < items.length; i++) {
        var item = items[i];
        final latVal = item['lat'];
        final lngVal = item['lng'];
        
        double? lat;
        double? lng;
        
        if (latVal != null) lat = double.tryParse(latVal.toString());
        if (lngVal != null) lng = double.tryParse(lngVal.toString());
        
        final name = item['name'] ?? '景點';
        final time = item['time'] ?? '';
        
        final bool isStart = (i == 0);
        final String labelText = isStart ? 'S' : (i + 1).toString();

        if (lat != null && lng != null) {
          final position = LatLng(lat, lng);
          currentDayRoute.add(position);
          
          minLat = min(minLat, lat);
          maxLat = max(maxLat, lat);
          minLng = min(minLng, lng);
          maxLng = max(maxLng, lng);
          hasValidCoords = true;

          final markerColor = isStart ? const Color(0xFF1E293B) : dayColor;
          final BitmapDescriptor customIcon = await _createCustomMarkerBitmap(labelText, markerColor);

          newMarkers.add(
            Marker(
              markerId: MarkerId('marker_$markerIdCounter'),
              position: position,
              infoWindow: InfoWindow(
                title: isStart ? '🚩 Day $dayNum 起點: $name' : 'Day $dayNum: $name',
                snippet: time,
              ),
              icon: customIcon,
              zIndex: isStart ? 2.0 : 1.0, 
            ),
          );
          markerIdCounter++;
        }
      }

      if (currentDayRoute.length > 1) {
        newPolylines.add(
          Polyline(
            polylineId: PolylineId('route_day_$dayNum'),
            points: currentDayRoute,
            color: dayColor.withOpacity(0.85), 
            width: 5,
            jointType: JointType.round,
          ),
        );
      }
    }
    
    if (!mounted) return;

    setState(() {
      _markers = newMarkers;
      _polylines = newPolylines;
    });

    if (hasValidCoords && _mapController != null) {
      LatLngBounds bounds = LatLngBounds(
        southwest: LatLng(minLat - 0.005, minLng - 0.005),
        northeast: LatLng(maxLat + 0.005, maxLng + 0.005),
      );
      
      _mapController!.animateCamera(
        CameraUpdate.newLatLngBounds(bounds, 50.0), 
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final city = widget.plan['city'] ?? '行程地圖';
    final List<dynamic> daysList = widget.plan['days'] ?? [];

    return Scaffold(
          appBar: AppBar(
        title: Text('$city • 路線圖', style: const TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.text,
        elevation: 0,
      ),
      body: Stack(
        children: [
          GoogleMap(
            // 🆕 4. 直接給予第一天的起點作為最原始視角，杜絕畫面亂跳！
            initialCameraPosition: CameraPosition(
              target: _initialTarget ?? const LatLng(25.0330, 121.5654),
              zoom: 14, // 14 是一個看清楚街區與起點的完美預設縮放
            ),
            markers: _markers,
            polylines: _polylines, 
            myLocationEnabled: true, 
            myLocationButtonEnabled: true,
            mapToolbarEnabled: false,
            zoomControlsEnabled: false, 
            onMapCreated: (controller) {
              _mapController = controller;
            },
          ),
          
          if (daysList.isNotEmpty)
            Positioned(
              top: 16,
              left: 0,
              right: 0,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                            _buildDayButton(
                              label: '全部路線',
                              isSelected: _selectedDay == null,
                              color: AppColors.text,
                      onTap: () {
                        setState(() => _selectedDay = null);
                        _updateMapData(); 
                      },
                    ),
                    const SizedBox(width: 8),
                    ...daysList.map((dayObj) {
                      final dayNum = dayObj['day'] ?? 1;
                      final int colorIdx = (dayNum - 1) % _lineColors.length;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8.0),
                        child: _buildDayButton(
                          label: '第 $dayNum 天',
                          isSelected: _selectedDay == dayNum,
                          color: _lineColors[colorIdx],
                          onTap: () {
                            setState(() => _selectedDay = dayNum);
                            _updateMapData();
                          },
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildDayButton({
    required String label,
    required bool isSelected,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? color : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? color : Colors.grey[300]!,
            width: 1.5,
          ),
          boxShadow: isSelected
              ? [BoxShadow(color: color.withOpacity(0.3), blurRadius: 8, offset: const Offset(0, 2))]
              : [const BoxShadow(color: Colors.black12, blurRadius: 4, offset: const Offset(0, 2))],
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.black87,
            fontWeight: FontWeight.bold,
            fontSize: 14,
          ),
        ),
      ),
    );
  }
}