import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCw, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface ImageCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageType: '2x2' | 'id';
  onSave: (croppedImageUrl: string, originalImageUrl: string) => Promise<void>;
  existingImageUrl?: string; // Optional: if provided, crop this image instead of uploading new
}

export function ImageCropDialog({ 
  open, 
  onOpenChange, 
  imageType, 
  onSave,
  existingImageUrl 
}: ImageCropDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: imageType === '2x2' ? 50 : 70,
    height: imageType === '2x2' ? 50 : 70,
    x: 25,
    y: 25,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);

  // Load existing image when dialog opens
  React.useEffect(() => {
    if (open && existingImageUrl) {
      setImageSrc(existingImageUrl);
      setOriginalFile(null); // No original file for existing images
    } else if (!open) {
      // Reset when closing
      setImageSrc('');
      setOriginalFile(null);
      setCrop({
        unit: '%',
        width: imageType === '2x2' ? 50 : 70,
        height: imageType === '2x2' ? 50 : 70,
        x: 25,
        y: 25,
      });
      setCompletedCrop(null);
      setZoom(1);
      setRotation(0);
    }
  }, [open, existingImageUrl, imageType]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOriginalFile(file);
    setUploading(true);

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const getCroppedImg = useCallback(
    (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('No 2d context');
      }

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      canvas.width = crop.width * scaleX;
      canvas.height = crop.height * scaleY;

      ctx.imageSmoothingQuality = 'high';

      // Apply rotation if needed
      if (rotation !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }

      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas is empty'));
            }
          },
          'image/jpeg',
          0.95
        );
      });
    },
    [rotation]
  );

  const uploadImage = async (blob: Blob, filename: string): Promise<string> => {
    const formData = new FormData();
    formData.append('image', blob, filename);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();
    return data.url;
  };

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) {
      alert('Please crop the image first');
      return;
    }

    setSaving(true);
    try {
      let originalUrl = existingImageUrl || '';

      // Only upload original if we have a new file
      if (originalFile) {
        originalUrl = await uploadImage(
          originalFile,
          `original_${imageType}_${Date.now()}.jpg`
        );
      }

      // Get and upload cropped image
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
      const croppedUrl = await uploadImage(
        croppedBlob,
        `cropped_${imageType}_${Date.now()}.jpg`
      );

      // Call parent save handler with both URLs
      await onSave(croppedUrl, originalUrl);

      // Reset state
      setImageSrc('');
      setCrop({
        unit: '%',
        width: imageType === '2x2' ? 50 : 70,
        height: imageType === '2x2' ? 50 : 70,
        x: 25,
        y: 25,
      });
      setCompletedCrop(null);
      setZoom(1);
      setRotation(0);
      setOriginalFile(null);

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving image:', error);
      alert('Failed to save image. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleAspectRatio = () => {
    if (imageType === '2x2') {
      setCrop({
        unit: '%',
        width: 50,
        height: 50,
        x: 25,
        y: 25,
      });
    } else {
      setCrop({
        unit: '%',
        width: 70,
        height: 50,
        x: 15,
        y: 25,
      });
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="lg:w-[50vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {existingImageUrl ? 'Crop' : 'Upload & Crop'} {imageType === '2x2' ? '2x2 Photo' : 'ID Picture'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {!imageSrc ? (
              <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed rounded-lg">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  size="lg"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Select Image'
                  )}
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  {imageType === '2x2'
                    ? 'Upload a passport-style photo'
                    : 'Upload a valid ID'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Crop Controls */}
                <div className="flex flex-wrap gap-2 p-3 bg-card rounded-lg">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRotate}
                  >
                    <RotateCw className="h-4 w-4 mr-2" />
                    Rotate
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAspectRatio}
                  >
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Reset Crop
                  </Button>

                  <div className="flex items-center gap-2 ml-auto">
                    <ZoomOut className="h-4 w-4" />
                    <Slider
                      value={[zoom]}
                      onValueChange={(val) => setZoom(val[0])}
                      min={0.5}
                      max={3}
                      step={0.1}
                      className="w-32"
                    />
                    <ZoomIn className="h-4 w-4" />
                    <span className="text-sm font-medium w-12 text-center">
                      {Math.round(zoom * 100)}%
                    </span>
                  </div>
                </div>

                {/* Image Crop Area */}
                <div className="flex justify-center border rounded-lg p-4 bg-card">
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={imageType === '2x2' ? 1 : undefined}
                  >
                    <img
                      ref={imgRef}
                      src={imageSrc}
                      alt="Crop preview"
                      style={{
                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                        maxHeight: '500px',
                        maxWidth: '100%',
                      }}
                    />
                  </ReactCrop>
                </div>

                {/* Helper Text */}
                <div className="p-3 bg-card border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Tips:</strong>
                  </p>
                  <ul className="text-sm text-blue-600 list-disc list-inside mt-1">
                    <li>Drag the crop area to adjust position</li>
                    <li>Resize corners to adjust crop size</li>
                    <li>Use zoom slider for precise cropping</li>
                    {!existingImageUrl && <li>Original image will be saved as backup</li>}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {imageSrc && (
              <>
                {!existingImageUrl && (
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                  >
                    Choose Different Image
                  </Button>
                )}
                <Button onClick={handleSave} disabled={saving || !completedCrop}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Cropped Image'
                  )}
                </Button>
              </>
            )}
            {!imageSrc && (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}