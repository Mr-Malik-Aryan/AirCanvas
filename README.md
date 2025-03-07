# AirCanvas 🖌️

AirCanvas is a gesture-controlled virtual drawing application that allows users to draw in the air using hand movements. By tracking a red colored marker on the fingertip, users can create digital artwork through natural hand gestures.

![AirCanvas Demo](https://raw.githubusercontent.com/Mr-Malik-Aryan/AirCanvas/main/demo.jpg)

## Features

- Real-time hand gesture tracking using MediaPipe
- Red color marker detection for drawing
- Clear canvas functionality
- Easy-to-use interface
- Customizable tracking settings

## Requirements

- Python 3.6+
- OpenCV
- NumPy
- MediaPipe

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/Mr-Malik-Aryan/AirCanvas.git
   cd AirCanvas
   ```

2. Install required packages:
   ```
   npm install
   ```

## Usage

1. Run the  script:
   ```
   npm run dev
   ```

2. Enable the Drawing mode and pinch (touch index finger and thumb) to enable /disable pen.

3. Use a finger tip the motion tracked will be shown.

4. Pinch again to de-select pen once finished drawing .

## How It Works

AirCanvas uses computer vision techniques with MediaPipe to track hand movements:

1. The webcam captures video input.
2. MediaPipe provides hand landmark detection.
3. Color thresholding isolates the red marker.
4. Contour detection identifies the marker position.
5. The detected positions are used to draw on a virtual canvas.
6. The virtual canvas is overlaid on the webcam feed.

## Customization

You can customize the tracking sensitivity in the code:

- Adjust HSV thresholds in the trackbars for better red color detection
- Modify drawing parameters in the file
- Change brush size by modifying the drawing thickness

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Powered by MediaPipe for hand tracking
- Built with OpenCV for Python image processing

## Author

- Aryan Malik - [GitHub](https://github.com/Mr-Malik-Aryan)
